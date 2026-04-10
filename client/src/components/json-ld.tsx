import { useEffect, useRef } from "react";

export function JsonLd({ data }: { data: Record<string, any> | Record<string, any>[] }) {
  const ref = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    ref.current = script;

    return () => {
      if (ref.current && document.head.contains(ref.current)) {
        document.head.removeChild(ref.current);
      }
    };
  }, [JSON.stringify(data)]);

  return null;
}
