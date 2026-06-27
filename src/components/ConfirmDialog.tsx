import { Dialog } from './Dialog.js';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} center>
      <p style={{ color: 'var(--color-text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
      <div className="dialog-actions">
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          aria-label={confirmLabel}
        >
          {confirmLabel}
        </button>
        <button className="btn btn-secondary" onClick={onCancel} aria-label={cancelLabel}>
          {cancelLabel}
        </button>
      </div>
    </Dialog>
  );
}
