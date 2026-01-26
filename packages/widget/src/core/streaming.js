import { cleanText, saveGuestHistory } from './storage.js';

export const STREAM_FLUSH_MS = 80;

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
      renderTimer: 0,
      finishReason: ''
    };
    widget.wsInFlightByRequestId.set(cleanRequestId, state);
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
  removeTypingRow(activeState);
  clearAnalysisTimer(activeState);
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

export function ensureTypingIndicator(widget, state) {
  if (!state || state.showAnalysis) return;
  state.showAnalysis = true;
  if (!state.typingRow) {
    state.typingRow = widget.messageController?.createTypingRow?.() || null;
  }
}

export async function ensureBotRow(widget, state) {
  if (!state || state.uiRow) return;
  state.uiRow = await widget.messageController?.addMessage({ type: 'assistant', text: '' });
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

export function clearRenderTimer(state) {
  if (!state?.renderTimer) return;
  clearTimeout(state.renderTimer);
  state.renderTimer = 0;
}

export function scheduleStreamFlush(widget, state) {
  if (!state || state.renderTimer) return;
  state.renderTimer = window.setTimeout(() => {
    state.renderTimer = 0;
    void flushStream(widget, state);
  }, STREAM_FLUSH_MS);
}

export async function flushStream(widget, state) {
  if (!state) return;
  if (state.pendingBuffer) {
    state.text += state.pendingBuffer;
    state.pendingBuffer = '';
  }
  if (state.text) {
    await ensureBotRow(widget, state);
    await widget.messageController?.updateMessageText?.(state.uiRow, state.text, {
      streaming: true
    });
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
  if (!finalText) {
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
