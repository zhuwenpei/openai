export interface WeatherStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number; // Station elevation in meters
}

export const CITIES: WeatherStation[] = [
  // 中国沿海及主要城市
  { id: "s-bj", name: "北京", lat: 39.9042, lon: 116.4074, elevation: 43.5 },
  { id: "s-sh", name: "上海", lat: 31.2304, lon: 121.4737, elevation: 4.0 },
  { id: "s-gz", name: "广州", lat: 23.1291, lon: 113.2644, elevation: 21.0 },
  { id: "s-sz", name: "深圳", lat: 22.5431, lon: 114.0579, elevation: 18.0 },
  { id: "s-hk", name: "香港", lat: 22.3193, lon: 114.1694, elevation: 32.0 },
  { id: "s-mo", name: "澳门", lat: 22.1987, lon: 113.5439, elevation: 15.0 },
  { id: "s-tw-tp", name: "台北", lat: 25.0330, lon: 121.5654, elevation: 9.0 },
  { id: "s-tw-kh", name: "高雄", lat: 22.6273, lon: 120.3014, elevation: 2.5 },
  { id: "s-tw-hl", name: "花莲", lat: 23.9769, lon: 121.6044, elevation: 16.0 },
  { id: "s-fj-fz", name: "福州", lat: 26.0745, lon: 119.2965, elevation: 84.0 },
  { id: "s-fj-xm", name: "厦门", lat: 24.4798, lon: 118.0894, elevation: 138.0 },
  { id: "s-zj-hz", name: "杭州", lat: 30.2741, lon: 120.1551, elevation: 42.0 },
  { id: "s-zj-wz", name: "温州", lat: 27.9943, lon: 120.6994, elevation: 7.0 },
  { id: "s-sd-qd", name: "青岛", lat: 36.0671, lon: 120.3826, elevation: 77.0 },
  { id: "s-js-nj", name: "南京", lat: 32.0603, lon: 118.7969, elevation: 8.9 },
  { id: "s-hn-hk", name: "海口", lat: 20.0174, lon: 110.3492, elevation: 14.0 },
  { id: "s-hn-sy", name: "三亚", lat: 18.2528, lon: 109.5119, elevation: 5.0 },
  { id: "s-gx-nn", name: "南宁", lat: 22.8155, lon: 108.3200, elevation: 73.0 },
  { id: "s-wh", name: "武汉", lat: 30.5928, lon: 114.3055, elevation: 23.0 },
  { id: "s-cs", name: "长沙", lat: 28.2282, lon: 112.9388, elevation: 68.0 },
  { id: "s-cd", name: "成都", lat: 30.6586, lon: 104.0649, elevation: 505.0 },
  { id: "s-cq", name: "重庆", lat: 29.5630, lon: 106.5516, elevation: 259.0 },
  { id: "s-jn", name: "济南", lat: 36.6512, lon: 117.1201, elevation: 51.0 },
  { id: "s-sjz", name: "石家庄", lat: 38.0428, lon: 114.5149, elevation: 80.0 },
  { id: "s-zz", name: "郑州", lat: 34.7466, lon: 113.6253, elevation: 110.0 },
  { id: "s-ty", name: "太原", lat: 37.8706, lon: 112.5489, elevation: 778.0 },
  { id: "s-xa", name: "西安", lat: 34.3416, lon: 108.9398, elevation: 397.0 },
  { id: "s-lz", name: "兰州", lat: 36.0611, lon: 103.8343, elevation: 1517.0 },
  { id: "s-gy", name: "贵阳", lat: 26.6470, lon: 106.6302, elevation: 1071.0 },
  { id: "s-km", name: "昆明", lat: 25.0406, lon: 102.7123, elevation: 1889.0 },
  { id: "s-gl", name: "桂林", lat: 25.2736, lon: 110.2902, elevation: 164.0 },
  { id: "s-st", name: "汕头", lat: 23.3540, lon: 116.6819, elevation: 3.0 },
  { id: "s-zj", name: "湛江", lat: 21.2707, lon: 110.3594, elevation: 25.0 },
  { id: "s-bh", name: "北海", lat: 21.4812, lon: 109.1192, elevation: 12.0 },
  { id: "s-qz", name: "泉州", lat: 24.8739, lon: 118.6757, elevation: 13.0 },
  { id: "s-pt", name: "莆田", lat: 25.4541, lon: 119.0078, elevation: 28.0 },
  { id: "s-nd", name: "宁德", lat: 26.6656, lon: 119.5479, elevation: 18.0 },
  { id: "s-tz", name: "台州", lat: 28.6564, lon: 121.4208, elevation: 15.0 },
  { id: "s-nb", name: "宁波", lat: 29.8683, lon: 121.5440, elevation: 5.0 },
  { id: "s-zs", name: "舟山", lat: 30.0108, lon: 122.2048, elevation: 36.0 },
  { id: "s-jx", name: "嘉兴", lat: 30.7495, lon: 120.7555, elevation: 6.0 },
  { id: "s-nt", name: "南通", lat: 32.0162, lon: 120.8943, elevation: 5.0 },
  { id: "s-yc", name: "盐城", lat: 33.3496, lon: 120.1636, elevation: 4.0 },
  { id: "s-lyg", name: "连云港", lat: 34.6000, lon: 119.1788, elevation: 11.0 },
  { id: "s-rz", name: "日照", lat: 35.4164, lon: 119.5269, elevation: 19.0 },
  { id: "s-yt", name: "烟台", lat: 37.4638, lon: 121.4479, elevation: 48.0 },
  { id: "s-wh2", name: "威海", lat: 37.5131, lon: 122.1204, elevation: 27.0 },
  { id: "s-tj", name: "天津", lat: 39.0842, lon: 117.2009, elevation: 3.0 },
  { id: "s-qhd", name: "秦皇岛", lat: 39.9354, lon: 119.6005, elevation: 20.0 },
  { id: "s-dl", name: "大连", lat: 38.9140, lon: 121.6148, elevation: 91.0 },
  { id: "s-dd", name: "丹东", lat: 40.1133, lon: 124.3830, elevation: 10.0 },

  // 日本、韩国及东亚周边
  { id: "s-jp-ty", name: "东京", lat: 35.6895, lon: 139.6917, elevation: 25.0 },
  { id: "s-jp-os", name: "大阪", lat: 34.6937, lon: 135.5023, elevation: 12.0 },
  { id: "s-jp-nk", name: "那霸", lat: 26.2124, lon: 127.6809, elevation: 8.0 },
  { id: "s-jp-kg", name: "鹿儿岛", lat: 31.5966, lon: 130.5571, elevation: 4.0 },
  { id: "s-jp-my", name: "宫古岛", lat: 24.7932, lon: 125.2811, elevation: 38.0 },
  { id: "s-kr-sl", name: "首尔", lat: 37.5665, lon: 126.9780, elevation: 86.0 },
  { id: "s-kr-bs", name: "釜山", lat: 35.1796, lon: 129.0756, elevation: 69.0 },
  { id: "s-kr-jj", name: "济州", lat: 33.4996, lon: 126.5312, elevation: 21.0 },

  // 东南亚及西太平洋群岛
  { id: "s-ph-mn", name: "马尼拉", lat: 14.5995, lon: 120.9842, elevation: 16.0 },
  { id: "s-ph-cb", name: "宿雾", lat: 10.3157, lon: 123.8854, elevation: 8.0 },
  { id: "s-vn-hn", name: "河内", lat: 21.0285, lon: 105.8542, elevation: 12.0 },
  { id: "s-vn-dn", name: "岘港", lat: 16.0544, lon: 108.2022, elevation: 10.0 },
  { id: "s-vn-hcm", name: "胡志明", lat: 10.8231, lon: 106.6297, elevation: 19.0 },
  { id: "s-sg", name: "新加坡", lat: 1.3521, lon: 103.8198, elevation: 15.0 },
  { id: "s-pac-guam", name: "关岛", lat: 13.4443, lon: 144.7937, elevation: 75.0 },
  { id: "s-pac-saipan", name: "塞班岛", lat: 15.1783, lon: 145.7575, elevation: 62.0 },
  { id: "s-pac-palau", name: "帕劳(柯罗)", lat: 7.3419, lon: 134.4792, elevation: 33.0 },
  { id: "s-pac-chuuk", name: "楚克群岛", lat: 7.4500, lon: 151.8500, elevation: 15.0 },

  // 中南太平洋及大洋洲
  { id: "s-pac-hnl", name: "火奴鲁鲁(夏威夷)", lat: 21.3069, lon: -157.8583, elevation: 10.0 },
  { id: "s-pac-syd", name: "悉尼", lat: -33.8688, lon: 151.2093, elevation: 39.0 },
  { id: "s-pac-bne", name: "布里斯班", lat: -27.4705, lon: 153.0260, elevation: 28.0 },
  { id: "s-pac-akl", name: "奥克兰(新西兰)", lat: -36.8485, lon: 174.7633, elevation: 40.0 },
  { id: "s-pac-fji", name: "苏瓦(斐济)", lat: -18.1248, lon: 178.4501, elevation: 18.0 },

  // 美洲西海岸 (东太平洋)
  { id: "s-us-la", name: "洛杉矶", lat: 34.0522, lon: -118.2437, elevation: 89.0 },
  { id: "s-us-sf", name: "旧金山", lat: 37.7749, lon: -122.4194, elevation: 16.0 },
  { id: "s-mx-cab", name: "卡波圣卢卡斯(墨西哥)", lat: 22.8905, lon: -109.9167, elevation: 12.0 }
];

