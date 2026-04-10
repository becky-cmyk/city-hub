import { useState, useEffect } from "react";

const CLT_LOGO_FALLBACK = "/icons/clt-logo.png";

export function BizImage({
  src,
  alt = "",
  className = "",
  "data-testid": testId,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const effectiveSrc = (!src || failed) ? CLT_LOGO_FALLBACK : src;
  const useFallback = effectiveSrc === CLT_LOGO_FALLBACK;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={`${className}${useFallback ? " object-contain p-1" : ""}`}
      onError={() => setFailed(true)}
      loading="lazy"
      data-testid={testId}
    />
  );
}

export { CLT_LOGO_FALLBACK };
