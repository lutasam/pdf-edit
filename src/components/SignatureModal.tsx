import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X } from 'lucide-react';

interface Props {
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}

export default function SignatureModal({ onApply, onClose }: Props) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleApply = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      // Use getCanvas() + toDataURL() directly — getTrimmedCanvas() crashes
      // due to a broken trim-canvas ESM export in react-signature-canvas
      const canvas = sigRef.current.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      onApply(dataUrl);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          padding: 24,
          width: 520,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Draw your signature</h3>
          <button onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div
          onPointerDown={() => setIsEmpty(false)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              width: 470,
              height: 200,
              style: { width: '100%', height: 200 },
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={() => {
              sigRef.current?.clear();
              setIsEmpty(true);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: 14,
            }}
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            disabled={isEmpty}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: isEmpty ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              opacity: isEmpty ? 0.6 : 1,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
