const PACKS = {
  en: {
    'placeholder.search': 'Ask a crypto question...',
    'placeholder.composer': 'Type your message...',
    'button.login': 'Sign in',
    'button.logout': 'Sign out',
    'button.delete': 'Clear chat',
    'modal.delete.title': 'Clear this chat?',
    'modal.delete.sub': 'This removes your local chat history on this device.',
    'modal.logout.title': 'Sign out?',
    'modal.logout.sub': 'You can sign in again anytime.',
    'privacy.notice': 'Privacy notice',
    'errors.network': 'Network error. Please try again.',
    'errors.timeout': 'Request timed out. Please try again.',
    'errors.generic': 'Something went wrong. Please try again.'
  },

  nl: {
    'placeholder.search': 'Stel een crypto-vraag...',
    'placeholder.composer': 'Typ je bericht...',
    'button.login': 'Inloggen',
    'button.logout': 'Uitloggen',
    'button.delete': 'Chat wissen',
    'modal.delete.title': 'Deze chat wissen?',
    'modal.delete.sub': 'Dit verwijdert je lokale chatgeschiedenis op dit apparaat.',
    'modal.logout.title': 'Uitloggen?',
    'modal.logout.sub': 'Je kunt later weer inloggen.',
    'privacy.notice': 'Privacybericht',
    'errors.network': 'Netwerkfout. Probeer het opnieuw.',
    'errors.timeout': 'Time-out. Probeer het opnieuw.',
    'errors.generic': 'Er ging iets mis. Probeer het opnieuw.'
  },

  de: {
    'placeholder.search': 'Stelle eine Krypto-Frage...',
    'placeholder.composer': 'Nachricht eingeben...',
    'button.login': 'Anmelden',
    'button.logout': 'Abmelden',
    'button.delete': 'Chat leeren',
    'modal.delete.title': 'Diesen Chat leeren?',
    'modal.delete.sub': 'Dies entfernt den lokalen Verlauf auf diesem Gerät.',
    'modal.logout.title': 'Abmelden?',
    'modal.logout.sub': 'Du kannst dich jederzeit wieder anmelden.',
    'privacy.notice': 'Datenschutzhinweis',
    'errors.network': 'Netzwerkfehler. Bitte erneut versuchen.',
    'errors.timeout': 'Zeitüberschreitung. Bitte erneut versuchen.',
    'errors.generic': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.'
  },

  fr: {
    'placeholder.search': 'Posez une question crypto...',
    'placeholder.composer': 'Tapez votre message...',
    'button.login': 'Se connecter',
    'button.logout': 'Se déconnecter',
    'button.delete': 'Effacer le chat',
    'modal.delete.title': 'Effacer ce chat ?',
    'modal.delete.sub': 'Cela supprime l’historique local sur cet appareil.',
    'modal.logout.title': 'Se déconnecter ?',
    'modal.logout.sub': 'Vous pourrez vous reconnecter à tout moment.',
    'privacy.notice': 'Avis de confidentialité',
    'errors.network': 'Erreur réseau. Réessayez.',
    'errors.timeout': 'Délai dépassé. Réessayez.',
    'errors.generic': 'Une erreur est survenue. Réessayez.'
  },

  es: {
    'placeholder.search': 'Haz una pregunta sobre crypto...',
    'placeholder.composer': 'Escribe tu mensaje...',
    'button.login': 'Iniciar sesión',
    'button.logout': 'Cerrar sesión',
    'button.delete': 'Borrar chat',
    'modal.delete.title': '¿Borrar este chat?',
    'modal.delete.sub': 'Esto elimina el historial local en este dispositivo.',
    'modal.logout.title': '¿Cerrar sesión?',
    'modal.logout.sub': 'Puedes volver a iniciar sesión cuando quieras.',
    'privacy.notice': 'Aviso de privacidad',
    'errors.network': 'Error de red. Inténtalo de nuevo.',
    'errors.timeout': 'Tiempo agotado. Inténtalo de nuevo.',
    'errors.generic': 'Algo salió mal. Inténtalo de nuevo.'
  },

  it: {
    'placeholder.search': 'Fai una domanda crypto...',
    'placeholder.composer': 'Scrivi il messaggio...',
    'button.login': 'Accedi',
    'button.logout': 'Esci',
    'button.delete': 'Svuota chat',
    'modal.delete.title': 'Svuotare questa chat?',
    'modal.delete.sub': 'Rimuove la cronologia locale su questo dispositivo.',
    'modal.logout.title': 'Uscire?',
    'modal.logout.sub': 'Puoi accedere di nuovo in qualsiasi momento.',
    'privacy.notice': 'Informativa privacy',
    'errors.network': 'Errore di rete. Riprova.',
    'errors.timeout': 'Tempo scaduto. Riprova.',
    'errors.generic': 'Si è verificato un errore. Riprova.'
  },

  pt: {
    'placeholder.search': 'Faça uma pergunta sobre cripto...',
    'placeholder.composer': 'Digite sua mensagem...',
    'button.login': 'Entrar',
    'button.logout': 'Sair',
    'button.delete': 'Limpar chat',
    'modal.delete.title': 'Limpar este chat?',
    'modal.delete.sub': 'Isso remove o histórico local neste dispositivo.',
    'modal.logout.title': 'Sair?',
    'modal.logout.sub': 'Você pode entrar novamente a qualquer momento.',
    'privacy.notice': 'Aviso de privacidade',
    'errors.network': 'Erro de rede. Tente novamente.',
    'errors.timeout': 'Tempo esgotado. Tente novamente.',
    'errors.generic': 'Algo deu errado. Tente novamente.'
  },

  pl: {
    'placeholder.search': 'Zadaj pytanie o krypto...',
    'placeholder.composer': 'Wpisz wiadomość...',
    'button.login': 'Zaloguj się',
    'button.logout': 'Wyloguj się',
    'button.delete': 'Wyczyść czat',
    'modal.delete.title': 'Wyczyścić ten czat?',
    'modal.delete.sub': 'To usuwa lokalną historię na tym urządzeniu.',
    'modal.logout.title': 'Wylogować się?',
    'modal.logout.sub': 'Możesz zalogować się ponownie w każdej chwili.',
    'privacy.notice': 'Informacja o prywatności',
    'errors.network': 'Błąd sieci. Spróbuj ponownie.',
    'errors.timeout': 'Przekroczono limit czasu. Spróbuj ponownie.',
    'errors.generic': 'Coś poszło nie tak. Spróbuj ponownie.'
  },

  tr: {
    'placeholder.search': 'Kripto hakkında soru sorun...',
    'placeholder.composer': 'Mesajınızı yazın...',
    'button.login': 'Giriş yap',
    'button.logout': 'Çıkış yap',
    'button.delete': 'Sohbeti temizle',
    'modal.delete.title': 'Bu sohbet temizlensin mi?',
    'modal.delete.sub': 'Bu cihazdaki yerel sohbet geçmişi silinir.',
    'modal.logout.title': 'Çıkış yapılsın mı?',
    'modal.logout.sub': 'İstediğiniz zaman tekrar giriş yapabilirsiniz.',
    'privacy.notice': 'Gizlilik bildirimi',
    'errors.network': 'Ağ hatası. Tekrar deneyin.',
    'errors.timeout': 'Zaman aşımı. Tekrar deneyin.',
    'errors.generic': 'Bir hata oluştu. Tekrar deneyin.'
  },

  ar: {
    'placeholder.search': 'اسأل سؤالًا عن العملات الرقمية...',
    'placeholder.composer': 'اكتب رسالتك...',
    'button.login': 'تسجيل الدخول',
    'button.logout': 'تسجيل الخروج',
    'button.delete': 'مسح الدردشة',
    'modal.delete.title': 'مسح هذه الدردشة؟',
    'modal.delete.sub': 'سيتم حذف السجل المحلي على هذا الجهاز.',
    'modal.logout.title': 'تسجيل الخروج؟',
    'modal.logout.sub': 'يمكنك تسجيل الدخول مجددًا في أي وقت.',
    'privacy.notice': 'إشعار الخصوصية',
    'errors.network': 'خطأ في الشبكة. حاول مرة أخرى.',
    'errors.timeout': 'انتهت المهلة. حاول مرة أخرى.',
    'errors.generic': 'حدث خطأ ما. حاول مرة أخرى.'
  },

  ja: {
    'placeholder.search': '暗号資産について質問...',
    'placeholder.composer': 'メッセージを入力...',
    'button.login': 'ログイン',
    'button.logout': 'ログアウト',
    'button.delete': 'チャットを消去',
    'modal.delete.title': 'このチャットを消去しますか？',
    'modal.delete.sub': 'この端末のローカル履歴が削除されます。',
    'modal.logout.title': 'ログアウトしますか？',
    'modal.logout.sub': 'いつでも再ログインできます。',
    'privacy.notice': 'プライバシー通知',
    'errors.network': 'ネットワークエラー。再試行してください。',
    'errors.timeout': 'タイムアウトしました。再試行してください。',
    'errors.generic': 'エラーが発生しました。再試行してください。'
  },

  zh: {
    'placeholder.search': '问一个加密货币问题...',
    'placeholder.composer': '输入你的消息...',
    'button.login': '登录',
    'button.logout': '退出登录',
    'button.delete': '清空聊天',
    'modal.delete.title': '清空此聊天记录？',
    'modal.delete.sub': '这将删除此设备上的本地记录。',
    'modal.logout.title': '退出登录？',
    'modal.logout.sub': '你可以随时重新登录。',
    'privacy.notice': '隐私提示',
    'errors.network': '网络错误。请重试。',
    'errors.timeout': '请求超时。请重试。',
    'errors.generic': '发生错误。请重试。'
  },

  ko: {
    'placeholder.search': '암호화폐 질문을 해보세요...',
    'placeholder.composer': '메시지를 입력하세요...',
    'button.login': '로그인',
    'button.logout': '로그아웃',
    'button.delete': '채팅 지우기',
    'modal.delete.title': '이 채팅을 지울까요?',
    'modal.delete.sub': '이 기기에서 로컬 기록이 삭제됩니다.',
    'modal.logout.title': '로그아웃할까요?',
    'modal.logout.sub': '언제든 다시 로그인할 수 있습니다.',
    'privacy.notice': '개인정보 안내',
    'errors.network': '네트워크 오류입니다. 다시 시도하세요.',
    'errors.timeout': '시간 초과입니다. 다시 시도하세요.',
    'errors.generic': '오류가 발생했습니다. 다시 시도하세요.'
  }
};

const SUPPORTED_LOCALES = Object.keys(PACKS);
const FALLBACK_LOCALE = 'en';

const normalizeLocale = (value) => String(value || '').trim().toLowerCase().replace('_', '-');

const matchLocale = (value) => {
  const normalized = normalizeLocale(value);
  if (!normalized) return '';
  if (SUPPORTED_LOCALES.includes(normalized)) return normalized;
  const base = normalized.split('-')[0];
  if (SUPPORTED_LOCALES.includes(base)) return base;
  return '';
};

const resolveLocale = () => {
  if (typeof window !== 'undefined') {
    const forced = matchLocale(window.__VALKI_LOCALE__);
    if (forced) return forced;
  }
  if (typeof navigator !== 'undefined') {
    const languages = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
    for (const lang of languages) {
      const match = matchLocale(lang);
      if (match) return match;
    }
  }
  return FALLBACK_LOCALE;
};

const readOverrides = () => {
  if (typeof window === 'undefined') return {};
  const raw = window.__VALKI_I18N_OVERRIDES__;
  if (!raw || typeof raw !== 'object') return {};
  return Object.entries(raw).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const getI18n = () => {
  const locale = resolveLocale();
  const basePack = PACKS[locale] || PACKS[FALLBACK_LOCALE];
  const overrides = readOverrides();
  const t = (key) => {
    if (typeof overrides[key] === 'string') return overrides[key];
    if (typeof basePack[key] === 'string') return basePack[key];
    if (typeof PACKS[FALLBACK_LOCALE][key] === 'string') return PACKS[FALLBACK_LOCALE][key];
    return key;
  };
  return {
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    t
  };
};

export const getSupportedLocales = () => SUPPORTED_LOCALES.slice();
