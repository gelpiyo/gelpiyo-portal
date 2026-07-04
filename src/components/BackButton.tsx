import { usePortalStore } from '@/stores/portalStore';

export function BackButton(): React.JSX.Element {
  const navigateToPortal = usePortalStore((s) => s.navigateToPortal);

  return (
    <button
      className="back-button"
      onClick={navigateToPortal}
      aria-label="ポータルへ戻る"
    >
      <span className="back-button__arrow">←</span>
      <span className="back-button__label">もどる</span>
    </button>
  );
}
