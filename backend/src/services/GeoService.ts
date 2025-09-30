import geoip from 'geoip-lite';

interface GeoLookupResult {
  country: string;
  province: string;
  city: string | null;
}

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^127\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const PROVINCE_MAPPINGS: Array<{ name: string; keywords: string[] }> = [
  { name: '北京', keywords: ['beijing', 'bj', '11', '110000', '北京市'] },
  { name: '天津', keywords: ['tianjin', 'tj', '12', '120000', '天津市'] },
  { name: '上海', keywords: ['shanghai', 'sh', '31', '310000', '上海市'] },
  { name: '重庆', keywords: ['chongqing', 'cq', '50', '500000', '重庆市'] },
  { name: '河北', keywords: ['hebei', 'he', '13', '130000'] },
  { name: '山西', keywords: ['shanxi', 'sx', '14', '140000'] },
  { name: '内蒙古', keywords: ['inner mongolia', 'neimenggu', 'nm', '15', '150000', 'neimeng'] },
  { name: '辽宁', keywords: ['liaoning', 'ln', '21', '210000'] },
  { name: '吉林', keywords: ['jilin', 'jl', '22', '220000'] },
  { name: '黑龙江', keywords: ['heilongjiang', 'hl', '23', '230000', 'heilong'] },
  { name: '江苏', keywords: ['jiangsu', 'js', '32', '320000'] },
  { name: '浙江', keywords: ['zhejiang', 'zj', '33', '330000'] },
  { name: '安徽', keywords: ['anhui', 'ah', '34', '340000'] },
  { name: '福建', keywords: ['fujian', 'fj', '35', '350000'] },
  { name: '江西', keywords: ['jiangxi', 'jx', '36', '360000'] },
  { name: '山东', keywords: ['shandong', 'sd', '37', '370000'] },
  { name: '河南', keywords: ['henan', 'ha', '41', '410000'] },
  { name: '湖北', keywords: ['hubei', 'hb', '42', '420000'] },
  { name: '湖南', keywords: ['hunan', 'hn', '43', '430000'] },
  { name: '广东', keywords: ['guangdong', 'gd', '44', '440000'] },
  { name: '广西', keywords: ['guangxi', 'gx', '45', '450000', 'guangxi zhuang', 'nanning'] },
  { name: '海南', keywords: ['hainan', 'hi', '46', '460000'] },
  { name: '四川', keywords: ['sichuan', 'sc', '51', '510000'] },
  { name: '贵州', keywords: ['guizhou', 'gz', '52', '520000'] },
  { name: '云南', keywords: ['yunnan', 'yn', '53', '530000'] },
  { name: '西藏', keywords: ['xizang', 'xz', '54', '540000', 'tibet', 'lhasa'] },
  { name: '陕西', keywords: ['shaanxi', 'sn', '61', '610000', 'shaanxi sheng', 'xian'] },
  { name: '甘肃', keywords: ['gansu', 'gs', '62', '620000'] },
  { name: '青海', keywords: ['qinghai', 'qh', '63', '630000'] },
  { name: '宁夏', keywords: ['ningxia', 'nx', '64', '640000'] },
  { name: '新疆', keywords: ['xinjiang', 'xj', '65', '650000', 'urumqi'] },
  { name: '香港', keywords: ['hong kong', 'hk'] },
  { name: '澳门', keywords: ['macau', 'mo', 'aomen'] },
  { name: '台湾', keywords: ['taiwan', 'tw', 'taipei'] },
];

const PROVINCE_NAMES = PROVINCE_MAPPINGS.map((item) => item.name);

export class GeoService {
  normalizeIp(ip?: string | null): string | null {
    if (!ip) {
      return null;
    }
    const raw = Array.isArray(ip) ? ip[0] : ip;
    const first = raw.split(',')[0]?.trim();
    if (!first) {
      return null;
    }
    const cleaned = first.replace(/^::ffff:/i, '');
    return cleaned || null;
  }

  private isPrivateIp(ip: string): boolean {
    return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
  }

  private matchProvince(region?: string | null, city?: string | null): string | null {
    const tokens = [region, city]
      .map((value) => (value ? value.toString().trim().toLowerCase() : ''))
      .filter(Boolean);

    for (const token of tokens) {
      const matched = PROVINCE_MAPPINGS.find((item) =>
        item.keywords.some((keyword) => token.includes(keyword))
      );
      if (matched) {
        return matched.name;
      }
    }

    // 对于 region 值可能是数字代码的情况，单独再匹配一次完整等值
    for (const value of [region, city]) {
      if (!value) continue;
      const normalized = value.toString().trim().toLowerCase();
      const matched = PROVINCE_MAPPINGS.find((item) =>
        item.keywords.some((keyword) => keyword === normalized)
      );
      if (matched) {
        return matched.name;
      }
    }

    return null;
  }

  lookup(ip: string | null | undefined): GeoLookupResult | null {
    if (!ip) {
      return null;
    }
    const normalized = this.normalizeIp(ip);
    if (!normalized) {
      return null;
    }

    if (this.isPrivateIp(normalized)) {
      return {
        country: 'LOCAL',
        province: '本地',
        city: null,
      };
    }

    try {
      const record = geoip.lookup(normalized);
      if (!record) {
        return {
          country: 'UNKNOWN',
          province: '未知',
          city: null,
        };
      }

      if (record.country !== 'CN') {
        return {
          country: record.country,
          province: '海外',
          city: record.city || null,
        };
      }

      const province = this.matchProvince(record.region, record.city) || '未知';
      return {
        country: record.country,
        province,
        city: record.city || null,
      };
    } catch (error) {
      console.warn('[GeoService] lookup failed:', error);
      return {
        country: 'UNKNOWN',
        province: '未知',
        city: null,
      };
    }
  }

  getProvinceNames(): string[] {
    return PROVINCE_NAMES;
  }
}

export const geoService = new GeoService();
