export const handleImageFiles = ({ files, onLoad, onError }) => {
  files.forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      onLoad(dataUrl);
    };
    reader.onerror = () => {
      if (onError) onError();
    };
    reader.readAsDataURL(file);
  });
};
