/**
 * Слой „настройки на страницата“ върху ПУБЛИЧНИТЕ страници.
 *
 * Показва се само на влязъл потребител с CRM роля (проверка `is_crm_staff`).
 * Анонимен посетител не вижда нищо ново — нито бутон, нито промяна в страницата.
 * Настройките се пазят в `crm_page_customizations` (лично, scope='user').
 */
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  CrmPageSettingsProvider,
  pageSettingsStyle,
  useCrmPageSettings,
} from "@/hooks/use-crm-page-settings";
import { CrmPageSettingsPanel } from "@/components/admin/page-settings/page-settings-panel";
import { CrmPageEditLayer } from "@/components/admin/page-settings/page-edit-mode";
import { CrmCustomBlocks } from "@/components/admin/page-settings/custom-blocks";

export function CrmSiteOverlay() {
  const { user, loading } = useAuth();
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStaff(false);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase.rpc("is_crm_staff", { _user_id: user.id });
        if (!cancelled) setStaff(data === true);
      } catch {
        if (!cancelled) setStaff(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user || !staff) return null;

  return (
    <CrmPageSettingsProvider>
      <OverlayInner />
    </CrmPageSettingsProvider>
  );
}

function OverlayInner() {
  const { settings, editMode, previewMode, setEditMode } = useCrmPageSettings();
  const [open, setOpen] = useState(false);
  const [docHeight, setDocHeight] = useState(0);

  // Слоят покрива цялата страница (не само видимата част), за да остават
  // поставените форми на мястото си при скрол.
  useEffect(() => {
    const measure = () => setDocHeight(document.documentElement.scrollHeight);
    measure();
    window.addEventListener("resize", measure);
    const t = window.setInterval(measure, 1200);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(t);
    };
  }, []);

  // Слоят за редакция търси блоковете в „[data-crm-page-root]“.
  useEffect(() => {
    const host = document.querySelector<HTMLElement>("main") ?? document.body;
    if (host.hasAttribute("data-crm-page-root")) return;
    host.setAttribute("data-crm-page-root", "");
    return () => host.removeAttribute("data-crm-page-root");
  }, []);

  return (
    <>
      <div
        className="pointer-events-none absolute left-0 top-0 w-full"
        style={{ height: docHeight || "100%", ...pageSettingsStyle(settings) }}
      >
        <div className="relative h-full w-full">
          <CrmCustomBlocks />
        </div>
      </div>

      {!previewMode && (
        <button
          type="button"
          data-crm-edit-ui
          onClick={() => setOpen((v) => !v)}
          aria-label="Настройки на страницата"
          title="Настройки на страницата (само за екипа)"
          className={`fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[9990] flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/70 shadow-[0_10px_30px_rgba(20,4,8,0.45)] transition lg:bottom-24 ${
            open || editMode
              ? "bg-amber-400 text-[#2b0210]"
              : "bg-[#4f0314] text-amber-200 hover:bg-[#63071c]"
          }`}
        >
          <Settings className={`h-5 w-5 ${editMode ? "animate-spin" : ""}`} />
        </button>
      )}

      {open && !previewMode && <CrmPageSettingsPanel onClose={() => setOpen(false)} />}
      {previewMode && (
        <div
          data-crm-edit-ui
          className="fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400/50 bg-[#4f0314] px-4 py-2 text-xs font-semibold text-amber-200 shadow-lg"
        >
          Преглед — така изглежда страницата
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-amber-100"
          >
            Изход
          </button>
        </div>
      )}
      <CrmPageEditLayer />
    </>
  );
}

export default CrmSiteOverlay;
