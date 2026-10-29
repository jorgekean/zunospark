import type { ZoneId } from '../db/zunoDb';

export type NodeIconType = 'sprout' | 'leaf' | 'dragonfly' | 'dusk' | 'boss';

export interface NodeConfig {
  nodeId: string;
  title: string;
  goRatio: number;
  windowMs: number;
  hasDistractor: boolean;
  isNightMode: boolean;
  requiredSparks: number;
  iconType: NodeIconType;
  zoneId: ZoneId;
  nodeIndex: number; // 0 to 4
}

export const ZONE_TRAILS: Record<ZoneId, NodeConfig[]> = {
  spark_berry: [
    {
      nodeId: 'berry_1',
      title: 'Sunny Patch',
      goRatio: 0.75,
      windowMs: 1800,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 0,
      iconType: 'sprout',
      zoneId: 'spark_berry',
      nodeIndex: 0,
    },
    {
      nodeId: 'berry_2',
      title: 'Shady Bush',
      goRatio: 0.7,
      windowMs: 1600,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 2,
      iconType: 'leaf',
      zoneId: 'spark_berry',
      nodeIndex: 1,
    },
    {
      nodeId: 'berry_3',
      title: 'Dragonfly Glade',
      goRatio: 0.65,
      windowMs: 1500,
      hasDistractor: true,
      isNightMode: false,
      requiredSparks: 5,
      iconType: 'dragonfly',
      zoneId: 'spark_berry',
      nodeIndex: 2,
    },
    {
      nodeId: 'berry_4',
      title: 'Dusk Clearing',
      goRatio: 0.6,
      windowMs: 1400,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 9,
      iconType: 'dusk',
      zoneId: 'spark_berry',
      nodeIndex: 3,
    },
    {
      nodeId: 'berry_5',
      title: 'Star-Berry Boss',
      goRatio: 0.55,
      windowMs: 1300,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 14,
      iconType: 'boss',
      zoneId: 'spark_berry',
      nodeIndex: 4,
    },
  ],
  thunder_chimes: [
    {
      nodeId: 'chime_1',
      title: '2-Step Echo',
      goRatio: 1.0,
      windowMs: 2000,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 0,
      iconType: 'sprout',
      zoneId: 'thunder_chimes',
      nodeIndex: 0,
    },
    {
      nodeId: 'chime_2',
      title: '3-Step Melody',
      goRatio: 1.0,
      windowMs: 1800,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 3,
      iconType: 'leaf',
      zoneId: 'thunder_chimes',
      nodeIndex: 1,
    },
    {
      nodeId: 'chime_3',
      title: 'Paused Echo',
      goRatio: 1.0,
      windowMs: 1600,
      hasDistractor: true,
      isNightMode: false,
      requiredSparks: 7,
      iconType: 'dragonfly',
      zoneId: 'thunder_chimes',
      nodeIndex: 2,
    },
    {
      nodeId: 'chime_4',
      title: '4-Step Harmony',
      goRatio: 1.0,
      windowMs: 1500,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 11,
      iconType: 'dusk',
      zoneId: 'thunder_chimes',
      nodeIndex: 3,
    },
    {
      nodeId: 'chime_5',
      title: 'Grand Symphony',
      goRatio: 1.0,
      windowMs: 1400,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 16,
      iconType: 'boss',
      zoneId: 'thunder_chimes',
      nodeIndex: 4,
    },
  ],
  twin_currents: [
    {
      nodeId: 'river_1',
      title: 'Parallel Stream',
      goRatio: 1.0,
      windowMs: 2000,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 0,
      iconType: 'sprout',
      zoneId: 'twin_currents',
      nodeIndex: 0,
    },
    {
      nodeId: 'river_2',
      title: 'Winding River',
      goRatio: 1.0,
      windowMs: 1800,
      hasDistractor: false,
      isNightMode: false,
      requiredSparks: 3,
      iconType: 'leaf',
      zoneId: 'twin_currents',
      nodeIndex: 1,
    },
    {
      nodeId: 'river_3',
      title: 'Bilateral Rapids',
      goRatio: 1.0,
      windowMs: 1600,
      hasDistractor: true,
      isNightMode: false,
      requiredSparks: 8,
      iconType: 'dragonfly',
      zoneId: 'twin_currents',
      nodeIndex: 2,
    },
    {
      nodeId: 'river_4',
      title: 'Starlight Falls',
      goRatio: 1.0,
      windowMs: 1500,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 12,
      iconType: 'dusk',
      zoneId: 'twin_currents',
      nodeIndex: 3,
    },
    {
      nodeId: 'river_5',
      title: 'Lotus Sanctuary',
      goRatio: 1.0,
      windowMs: 1400,
      hasDistractor: true,
      isNightMode: true,
      requiredSparks: 18,
      iconType: 'boss',
      zoneId: 'twin_currents',
      nodeIndex: 4,
    },
  ],
};

export function getNodeConfig(zoneId: ZoneId, nodeId: string): NodeConfig {
  const trail = ZONE_TRAILS[zoneId];
  const found = trail.find((n) => n.nodeId === nodeId);
  return found ?? trail[0];
}

export function getDefaultNodeId(zoneId: ZoneId): string {
  return ZONE_TRAILS[zoneId][0].nodeId;
}

export function getNextNodeId(zoneId: ZoneId, currentNodeId: string): string | null {
  const trail = ZONE_TRAILS[zoneId];
  const currentIndex = trail.findIndex((n) => n.nodeId === currentNodeId);
  if (currentIndex >= 0 && currentIndex < trail.length - 1) {
    return trail[currentIndex + 1].nodeId;
  }
  return null;
}
