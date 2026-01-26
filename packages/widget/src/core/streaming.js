import { cleanText, saveGuestHistory } from './storage.js';

export const STREAM_FLUSH_FIRST_MS = 70;
export const STREAM_FLUSH_REST_MS = 15;
export const STREAM_FIRST_CHUNK = 60;
export const STREAM_REST_CHUNK = 800;
export const PLACEHOLDER_DELAY_MS = 350;

function hasNonWhitespace(text) {
  return typeof text === 'string' && /\S/.test(text);
}

function hasRealContent(state) {
  return hasNonWhitespace(state?.text) || hasNonWhitespace(state?.pendingBuffer);
}

export function initStreamingState(widget, requestId) {
  const cleanRequestId = cleanText(requestId || '');
  if (!cleanRequestId) return null;
  let state = widget.wsInFlightByRequestId.get(cleanRequestId);
  if (!state) {
    state = {
      requestId: cleanRequestId,
      assistantMessageId: '',
      started: false,
      ended: false,
      finalized: false,
      text: '',
      pendingBuffer: '',
      lastSeq: 0,
      analysisTimer: 0,
      showAnalysis: false,
      typingRow: null,
      uiRow: null,
      placeholderActive: false,
      placeholderText: '',
      placeholderTimer: 0,
      placeholderDelayMs: PLACEHOLDER_DELAY_MS,
      streamPhase: 'first',
      renderTimer: 0,
      finishReason: ''
    };
    widget.wsInFlightByRequestId.set(cleanRequestId, state);
  } else {
    if (!state.placeholderDelayMs) {
      state.placeholderDelayMs = PLACEHOLDER_DELAY_MS;
    }
    if (state.placeholderTimer === undefined) {
      state.placeholderTimer = 0;
    }
    if (!state.streamPhase) {
      state.streamPhase = 'first';
    }
  }
  widget.wsStreaming = state;
  return state;
}

export function clearStreamingState(widget, requestId) {
  const cleanRequestId = cleanText(requestId || '');
  if (!cleanRequestId) {
    if (widget.wsStreaming) {
      removeTypingRow(widget.wsStreaming);
      clearAnalysisTimer(widget.wsStreaming);
      clearPlaceholderTimer(widget.wsStreaming);
      clearRenderTimer(widget.wsStreaming);
      widget.wsInFlightByRequestId.delete(widget.wsStreaming.requestId);
      widget.wsStreaming = null;
    }
    return;
  }
  const existing = widget.wsInFlightByRequestId.get(cleanRequestId);
  if (existing && widget.wsStreaming === existing) {
    widget.wsStreaming = null;
  }
  removeTypingRow(existing);
  clearAnalysisTimer(existing);
  clearPlaceholderTimer(existing);
  clearRenderTimer(existing);
  widget.wsInFlightByRequestId.delete(cleanRequestId);
}

export function shouldIgnoreStreamEvent(widget, requestId, eventType = '') {
  const cleanRequestId = cleanText(requestId || '');
  if (!cleanRequestId) return false;
  if (!widget.abortedRequestIds.has(cleanRequestId)) return false;
  if (eventType === 'assistant.message.end' || eventType === 'assistant.message.error') {
    widget.abortedRequestIds.delete(cleanRequestId);
  }
  return true;
}

export function abortActiveStream(widget, reason = 'new-request') {
  const activeState = widget.wsStreaming;
  if (!activeState) return false;
  widget.abortedRequestIds.add(activeState.requestId);
  if (widget.wsPendingMessage?.messageId) {
    widget.abortedMessageIds.add(widget.wsPendingMessage.messageId);
  }
  if (activeState.uiRow && activeState.placeholderActive && !hasRealContent(activeState)) {
    const removeRow =
      widget.messageController?.removeMessageRow ||
      widget.messageController?.removeMessage ||
      widget.messageController?.deleteRow;
    if (typeof removeRow === 'function') {
      removeRow(activeState.uiRow);
    } else {
      try {
        activeState.uiRow.remove();
      } catch {
        /* ignore */
      }
    }
    activeState.uiRow = null;
    activeState.placeholderActive = false;
    activeState.placeholderText = '';
  }
  removeTypingRow(activeState);
  clearAnalysisTimer(activeState);
  clearPlaceholderTimer(activeState);
  clearRenderTimer(activeState);
  widget.wsInFlightByRequestId.delete(activeState.requestId);
  widget.wsStreaming = null;
  if (widget.wsPendingMessage?.requestId === activeState.requestId) {
    widget.wsPendingMessage = null;
  }
  widget.isSending = false;
  widget.setSendingState(false);
  widget.updateDeleteButtonVisibility();
  console.debug('[ViChat debug] aborted stream', { reason, requestId: activeState.requestId });
  return true;
}

// Regression scenario:
// - Start stream -> placeholder appears -> abort before first delta -> placeholder must disappear.

export function ensureTypingIndicator(widget, state) {
  if (!state || state.showAnalysis) return;
  state.showAnalysis = true;
  if (!state.typingRow) {
    state.typingRow = widget.messageController?.createTypingRow?.() || null;
  }
}

export async function ensureBotRow(widget, state, initialText = '') {
  if (!state || state.uiRow) return;
  const nextText = typeof initialText === 'string' ? initialText : '';
  state.uiRow = await widget.messageController?.addMessage({ type: 'assistant', text: nextText });
}

export function removeTypingRow(state) {
  if (!state?.typingRow) return;
  try {
    state.typingRow.remove();
  } catch {
    /* ignore */
  }
  state.typingRow = null;
}

export function clearAnalysisTimer(state) {
  if (!state?.analysisTimer) return;
  clearTimeout(state.analysisTimer);
  state.analysisTimer = 0;
}

export function clearPlaceholderTimer(state) {
  if (!state?.placeholderTimer) return;
  clearTimeout(state.placeholderTimer);
  state.placeholderTimer = 0;
}

export function clearRenderTimer(state) {
  if (!state?.renderTimer) return;
  clearTimeout(state.renderTimer);
  state.renderTimer = 0;
}

export function schedulePlaceholderTimer(widget, state, placeholderText) {
  if (!state) return;
  clearPlaceholderTimer(state);
  state.placeholderText = placeholderText || '';
  state.placeholderTimer = window.setTimeout(() => {
    void (async () => {
      const activeState = widget.wsStreaming;
      if (!activeState || activeState !== state) return;
      if (activeState.requestId !== state.requestId) return;
      if (activeState.ended || activeState.finalized) return;
      if (widget.abortedRequestIds?.has(activeState.requestId)) return;
      if (hasRealContent(activeState)) return;
      const content = activeState.uiRow?.querySelector('.valki-msg-content');
      const existingText = content?.textContent?.trim() || '';
      if (activeState.uiRow && existingText) return;
      await ensureBotRow(widget, activeState, state.placeholderText);
      if (!activeState.uiRow) return;
      await widget.messageController?.updateMessageText?.(activeState.uiRow, state.placeholderText, {
        streaming: true
      });
      activeState.placeholderActive = true;
    })();
  }, state.placeholderDelayMs);
}

export function scheduleStreamFlush(widget, state) {
  if (!state || state.renderTimer) return;
  const delayMs = state.streamPhase === 'rest' ? STREAM_FLUSH_REST_MS : STREAM_FLUSH_FIRST_MS;
  state.renderTimer = window.setTimeout(() => {
    state.renderTimer = 0;
    void flushStream(widget, state);
  }, delayMs);
}

export async function flushStream(widget, state) {
  if (!state) return;
  if (state.pendingBuffer) {
    const chunkSize = state.streamPhase === 'rest' ? STREAM_REST_CHUNK : STREAM_FIRST_CHUNK;
    const chunk = state.pendingBuffer.slice(0, chunkSize);
    state.pendingBuffer = state.pendingBuffer.slice(chunk.length);
    state.text += chunk;
  }
  if (state.text.includes('\n\n')) {
    state.streamPhase = 'rest';
  }
  if (hasNonWhitespace(state.text)) {
    await ensureBotRow(widget, state, state.text);
    await widget.messageController?.updateMessageText?.(state.uiRow, state.text, {
      streaming: true
    });
  }
  if (state.pendingBuffer) {
    scheduleStreamFlush(widget, state);
    return;
  }
  if (state.ended) {
    await finalizeStreaming(widget, state);
  }
}

export async function finalizeStreaming(widget, state) {
  if (!state || state.finalized) return;
  state.finalized = true;
  state.showAnalysis = false;
  removeTypingRow(state);
  const finishReason = cleanText(state.finishReason || '');
  let finalText = state.text;
  if (!hasNonWhitespace(finalText)) {
    finalText = finishReason === 'error' ? widget.config.copy.genericError : widget.config.copy.noResponse;
    state.text = finalText;
  }

  if (!state.uiRow) {
    state.uiRow = await widget.messageController?.addMessage({ type: 'assistant', text: finalText });
  } else {
    await widget.messageController?.updateMessageText?.(state.uiRow, finalText, { streaming: false });
  }

  if (!widget.isLoggedIn()) {
    widget.guestHistory.push({
      type: 'assistant',
      text: finalText,
      images: widget.wsPendingMessage?.guestImages
    });
    saveGuestHistory(widget.guestHistory, widget.config, widget.currentAgentId);
    widget.guestMeter.maybePromptLoginAfterSend((opts) => widget.openAuthOverlay(opts.hard));
  }

  if (widget.wsPendingMessage?.requestId === state.requestId) {
    widget.wsPendingMessage = null;
  }
  widget.resetSendState();
  clearStreamingState(widget, state.requestId);
}
