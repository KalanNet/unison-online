// app/(public)/directory/layout.tsx
import type { ReactNode } from "react";

/**
 * ВАЖЛИВО:
 * - Це server component (без "use client"), тому Next нормально інжектить <title/og/twitter>.
 * - Сплеш і lock/unlock робимо через інлайн <script>, щоб не тягнути клієнтський layout.
 */
export default function DirectoryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Глобальні стилі для директорії + екран завантаження */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
html, body { background:#21353a; }
:root { --app-h: 100dvh; --logo-size:128px; }
body { min-height: var(--app-h); }
html { scrollbar-gutter: stable both-edges; }
body > footer, .site-footer { display:none !important; }

/* Splash */
#pv-boot-splash{
  position:fixed; inset:0; z-index:9999;
  background:#21353a; display:grid; place-items:center;
}
.pv-logo{
  width:var(--logo-size); height:var(--logo-size); display:block;
  user-select:none; -webkit-user-drag:none; pointer-events:none; background: transparent;
  clip-path: inset(var(--logo-size) 0 0 0); opacity:0;
  animation: logo-scan 1220ms steps(128, end) forwards, logo-fade 1220ms cubic-bezier(.22,.61,.36,1) forwards;
  will-change: clip-path, opacity;
}
@keyframes logo-scan {
  from { clip-path: inset(var(--logo-size) 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes logo-fade { from { opacity:0; } to { opacity:1; } }
@media (prefers-reduced-motion: reduce) {
  .pv-logo { animation:none; clip-path: inset(0 0 0 0); opacity:1; }
}
`,
        }}
      />

      {/* Екран завантаження */}
      <div id="pv-boot-splash" aria-hidden="true">
        <img
          className="pv-logo"
          src="/LogoLoader.png"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </div>

      {/* Невеликий інлайновий скрипт: lock scroll -> закрити сплеш -> unlock */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  try {
    // 1) Заблокуємо скрол до готовності
    var lockId = 'pv-lock-style';
    if (!document.getElementById(lockId)) {
      var s = document.createElement('style');
      s.id = lockId;
      s.textContent = 'html{overflow:hidden!important}';
      document.head.appendChild(s);
    }

    function unlock(){
      try { var st = document.getElementById(lockId); if (st) st.remove(); } catch(e){}
    }
    function closeSplash(){
      try { var el = document.getElementById('pv-boot-splash'); if (el) el.remove(); } catch(e){}
      unlock();
    }

    // 2) Закриття по завершенню анімації або за таймером-фолбеком
    var splash = document.getElementById('pv-boot-splash');
    if (splash) {
      var img = splash.querySelector('.pv-logo');
      if (img) {
        img.addEventListener('animationend', function(ev){
          try {
            if (ev && ev.animationName === 'logo-scan') {
              setTimeout(closeSplash, 400);
            }
          } catch(e){}
        }, { once: true });
      }
      // Фолбек, якщо подія не спрацює (або reduced-motion)
      setTimeout(closeSplash, 2200);
    } else {
      // Якщо сплешу немає — просто розблокуємо
      unlock();
    }

    // Додаткові фолбеки на випадок навігації/перемальовок
    window.addEventListener('pageshow', function(){ setTimeout(unlock, 0); }, { once:true });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') setTimeout(unlock, 0);
    });
  } catch(e){}
})();`,
        }}
      />

      {children}
    </>
  );
}
