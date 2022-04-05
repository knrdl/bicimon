self.addEventListener('fetch', async event => {
    const cache = await caches.open('sw-cache')
    try {
        const fresh = await fetch(event.request)
        cache.put(event.request, fresh.clone()).catch(e => console.error(e))
        event.respondWith(fresh)
    } catch (e) {
        event.respondWith(cache.match(event.request))
    }
})
