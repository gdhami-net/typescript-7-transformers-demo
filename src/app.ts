function debug(message: string): void {
  console.log('[debug] ' + message);
}

export interface Order {
  id: string;
  total: number;
}

export function largestOrder(orders: Order[]): Order | undefined {
  debug('largestOrder received ' + orders.length + ' orders');
  let best: Order | undefined;
  for (const order of orders) {
    if (best === undefined || order.total > best.total) {
      best = order;
    }
  }
  debug('largestOrder chose ' + (best === undefined ? 'nothing' : best.id));
  return best;
}
