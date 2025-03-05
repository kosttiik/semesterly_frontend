interface CacheItem<T> {
  data: T;
  timestamp: number;
}

class CacheService {
  private static EXPIRY_TIME = 1000 * 60 * 30; // 30 minutes

  static set<T>(key: string, data: T): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(item));
  }

  static get<T>(key: string): T | null {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsedItem: CacheItem<T> = JSON.parse(item);
    if (Date.now() - parsedItem.timestamp > this.EXPIRY_TIME) {
      localStorage.removeItem(key);
      return null;
    }

    return parsedItem.data;
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }
}

export default CacheService;
