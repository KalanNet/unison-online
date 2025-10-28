"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";

export default function DirectoryLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      var s = document.createElement('style');
      s.id = 'pv-lock-style';
      s.textContent = 'html{overflow:hidden !important}';
      document.head.appendChild(s);
    } catch (e) {}

    try {
      var splash = document.getElementById('pv-boot-splash');
      function unlock() {
        try { var st = document.getElementById('pv-lock-style'); st && st.remove(); } catch (e) {}
      }
      function close() {
        try { splash && splash.remove(); } catch (e) {}
        unlock();
      }
      if (splash) {
        var img = splash.querySelector('.pv-logo');
        if (img) {
          img.addEventListener('animationend', function(ev){
            if (ev && (ev as AnimationEvent).animationName === 'logo-scan') {
              setTimeout(close, 400);
            }
          }, { once:true });
        }
        setTimeout(close, 2200);
      } else {
        unlock();
      }
    } catch (e) {}
  }, []);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
html, body { background:#21353a; }
:root { --app-h: 100svh; --logo-size:128px; }
body { min-height: var(--app-h); }
html { scrollbar-gutter: stable both-edges; }
body > footer, .site-footer { display:none !important; }
#pv-boot-splash{
  position:fixed; inset:0; z-index:9999;
  background:#21353a; display:grid; place-items:center;
}
.pv-logo{ width:var(--logo-size); height:var(--logo-size); display:block;
  user-select:none; -webkit-user-drag:none; pointer-events:none; background: transparent;
  clip-path: inset(var(--logo-size) 0 0 0); opacity:0;
  animation: logo-scan 1220ms steps(128, end) forwards, logo-fade 1220ms cubic-bezier(.22,.61,.36,1) forwards;
  will-change: clip-path, opacity;
}
@keyframes logo-scan {
  from { clip-path: inset(var(--logo-size) 0 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
@keyframes logo-fade { from { opacity:0; } to { opacity:1; } }
@media (prefers-reduced-motion: reduce) {
  .pv-logo { animation:none; clip-path: inset(0 0 0 0); opacity:1; }
}
`,
        }}
      />
      <div id="pv-boot-splash" aria-hidden="true">
        <img
          className="pv-logo"
          src="/LogoLoader.png"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </div>
      {children}
    </>
  );
}
