import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SubmitOrganization({ citySlug }: { citySlug: string }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(`/${citySlug}/activate`, { replace: true });
  }, [citySlug, navigate]);

  return null;
}
