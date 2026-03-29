import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  children: React.ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const viewport = { w: window.innerWidth, h: window.innerHeight };

    let top = trigger.top - tip.height - 8;
    let left = trigger.left + trigger.width / 2 - tip.width / 2;

    // Flip below if not enough room above
    if (top < 8) top = trigger.bottom + 8;
    // Clamp horizontally
    if (left < 8) left = 8;
    if (left + tip.width > viewport.w - 8) left = viewport.w - tip.width - 8;

    setPos({ top, left });
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          className="tooltip-box"
          role="tooltip"
          style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { opacity: 0 }}
        >
          {text}
        </div>
      )}
    </>
  );
}
