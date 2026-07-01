interface PageBackgroundProps {
  image: string;
}

export function PageBackground({ image }: PageBackgroundProps) {
  return (
    <div className="page-bg-wrap" aria-hidden="true">
      <div className="page-bg-img" style={{ backgroundImage: `url(${image})` }} />
      <div className="page-bg-overlay" />
      <div className="page-bg-vignette" />
    </div>
  );
}
