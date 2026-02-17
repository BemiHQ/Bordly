// Custom component
export const CoinFlip = ({
  front,
  back,
  isFlipped,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped?: boolean;
}) => {
  const flipStyle = {
    transformStyle: 'preserve-3d' as const,
    backfaceVisibility: 'hidden' as const,
  };

  return (
    <div className="relative w-5 h-5" style={{ perspective: '200px' }}>
      <div
        className="absolute left-0 transition-all duration-400 ease-in-out"
        style={{ ...flipStyle, transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
      >
        {front}
      </div>
      <div
        className="absolute left-0 transition-all duration-400 ease-in-out"
        style={{ ...flipStyle, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {back}
      </div>
    </div>
  );
};
