export const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>, onClose: () => void) => {
    if (e.target === e.currentTarget) {
        onClose();
    }
};