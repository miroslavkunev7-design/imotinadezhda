import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

// @ts-expect-error — .jsx файловете са пренесени 1:1 от MASTER архива
import HomePage from "./components/HomePage.jsx";
import "./styles/locked-home.css";

/**
 * Заключената начална страница (STEP_09_FINAL_LOCK_DELIVERY / 01_FINAL_WORKING_APP).
 * Използва се само за десктоп изглед. Визуалният растер и слоевете са непроменени.
 */
type LockedHomeCatalog = {
    cities: Array<{ slug: string; name: string }>;
    quartersByCity: Record<string, Array<{ id: string; slug: string; name: string }>>;
    };

    export function LockedHomeDesktop({ catalog }: { catalog: LockedHomeCatalog }) {
  const navigate = useNavigate();

  useEffect(() => {
    (window as unknown as { __lockedHomeNavigate?: (p: string) => void }).__lockedHomeNavigate = (
      path: string,
    ) => {
      navigate({ to: path as never });
    };
    return () => {
      delete (window as unknown as { __lockedHomeNavigate?: (p: string) => void })
        .__lockedHomeNavigate;
    };
  }, [navigate]);

  return (
    <div className="locked-home-desktop">
      <HomePage catalog={catalog} />
    </div>
  );
}

export default LockedHomeDesktop;
