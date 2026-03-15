/* ═══════════════════════════════════════════════════════════
   Service Worker — مواقيت الصلاة
   المهام:
   1. تخزين الملفات في الكاش (يعمل بدون إنترنت)
   2. إرسال إشعارات الأذان في الخلفية حتى لو المتصفح مغلق
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'prayer-times-v1';

/* الملفات التي تُخزَّن في الكاش */
const CACHE_FILES = [
  './prayer_times.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap',
];

/* ── تثبيت SW وتخزين الكاش ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CACHE_FILES).catch(() => {})
    )
  );
  self.skipWaiting();
});

/* ── تنشيط SW ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── استجابة الطلبات من الكاش ── */
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

/* ══════════════════════════════════════════════════════════
   إشعارات الأذان في الخلفية
   الصفحة ترسل رسالة للـ SW بمواقيت الصلوات،
   والـ SW يضبط مؤقتات ويرسل إشعار عند الوقت
══════════════════════════════════════════════════════════ */

let scheduledTimers = [];

/* استقبال مواقيت الصلاة من الصفحة */
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_PRAYERS') {
    /* إلغاء المؤقتات القديمة */
    scheduledTimers.forEach(t => clearTimeout(t));
    scheduledTimers = [];

    const prayers = e.data.prayers; /* [{key, name, timeMs}] */
    const now = Date.now();

    prayers.forEach(p => {
      const delay = p.timeMs - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const t = setTimeout(() => {
          sendAzanNotification(p.name, p.key);
        }, delay);
        scheduledTimers.push(t);
      }
    });
  }
});

/* إرسال الإشعار */
function sendAzanNotification(prayerName, key) {
  const icons = {
    fajr: '🌅', dhuhr: '🕛', asr: '🌤️', maghrib: '🌇', isha: '🌙'
  };
  self.registration.showNotification(`🕌 حان وقت صلاة ${prayerName}`, {
    body: 'اضغط هنا لفتح التطبيق وتشغيل الأذان',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'azan-' + key,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: { key, url: './prayer_times.html' },
  });
}

/* فتح التطبيق عند الضغط على الإشعار */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('prayer_times') && 'focus' in client) {
          client.postMessage({ type: 'PLAY_AZAN', key: e.notification.data?.key });
          return client.focus();
        }
      }
      return clients.openWindow(e.notification.data?.url || './prayer_times.html');
    })
  );
});
