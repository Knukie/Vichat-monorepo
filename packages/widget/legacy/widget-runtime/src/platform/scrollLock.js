export const lockBody = () => {
  const body = document.body;
  const scrollY = window.scrollY || window.pageYOffset;
  const state = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    scrollY
  };
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  return state;
};

export const unlockBody = (state) => {
  if (!state) return;
  const body = document.body;
  body.style.position = state.position;
  body.style.top = state.top;
  body.style.left = state.left;
  body.style.right = state.right;
  body.style.width = state.width;
  body.style.overflow = state.overflow;
  window.scrollTo(0, state.scrollY || 0);
};
