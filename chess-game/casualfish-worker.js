/* CasualFish arama iş parçacığı: sayfa hesaplama sırasında donmaz. */
importScripts('casualfish.js');

self.onmessage = (event) => {
    const { id, fen, moves, level, allowed } = event.data;
    const opts = { ...(CasualFishEngine.LEVELS[level] || CasualFishEngine.LEVELS[2]), fen, moves, allowed };
    self.postMessage({ id, ...CasualFishEngine.search(opts) });
};
