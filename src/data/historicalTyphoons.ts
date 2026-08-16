/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Typhoon, TyphoonState, TyphoonCategory } from "../types";

export interface HistoricalTyphoonData {
  name: string;
  year: number;
  startDateStr: string; // e.g. "2018-09-11T08:00:00"
  points: Array<{
    lat: number;
    lon: number;
    vmax: number; // m/s
    pmin?: number; // hPa, optional
    r7?: { ne: number; se: number; sw: number; nw: number };
  }>;
  description: string;
}

export const HISTORICAL_TYPHOONS: HistoricalTyphoonData[] = [
  {
    name: "超强台风“康芮” (Kong-rey)",
    year: 2025,
    startDateStr: "2025-10-25T08:00:00",
    description: "2025年秋季超强台风，结构极其对称庞大。横扫台湾岛东部后沿浙闽沿海北上，引发华东沿海强风暴雨。",
    points: [
      { lat: 16.5, lon: 135.0, vmax: 20, pmin: 995 },
      { lat: 17.2, lon: 132.5, vmax: 28, pmin: 982 },
      { lat: 18.0, lon: 129.8, vmax: 38, pmin: 968 },
      { lat: 19.1, lon: 126.8, vmax: 48, pmin: 945 },
      { lat: 20.3, lon: 124.2, vmax: 58, pmin: 925 },
      { lat: 21.8, lon: 122.5, vmax: 62, pmin: 915 },
      { lat: 23.2, lon: 121.4, vmax: 55, pmin: 930 }, // Landfall Taiwan Taitung
      { lat: 25.1, lon: 120.2, vmax: 35, pmin: 975 },
      { lat: 27.5, lon: 121.5, vmax: 28, pmin: 985 },
      { lat: 29.8, lon: 123.0, vmax: 20, pmin: 992 }
    ]
  },
  {
    name: "超强台风“摩羯” (Yagi)",
    year: 2024,
    startDateStr: "2024-09-01T08:00:00",
    description: "2024年登陆我国的最强台风，极速爆发性增强达到68m/s，先后登陆海南文昌与广东徐闻，造成海南华南毁灭性风灾。",
    points: [
      { lat: 14.2, lon: 124.0, vmax: 20, pmin: 995 },
      { lat: 15.8, lon: 121.2, vmax: 25, pmin: 988 },
      { lat: 18.0, lon: 118.5, vmax: 35, pmin: 972 },
      { lat: 19.1, lon: 116.0, vmax: 50, pmin: 940 },
      { lat: 19.3, lon: 113.8, vmax: 62, pmin: 915 },
      { lat: 19.7, lon: 111.2, vmax: 68, pmin: 900 }, // Peak SuperTY
      { lat: 19.9, lon: 110.8, vmax: 62, pmin: 910 }, // Landfall Wenchang, Hainan
      { lat: 20.3, lon: 109.8, vmax: 58, pmin: 920 }, // Landfall Xuwen, Guangdong
      { lat: 21.0, lon: 107.5, vmax: 42, pmin: 950 }, // Landfall Vietnam
      { lat: 21.8, lon: 104.5, vmax: 20, pmin: 990 }
    ]
  },
  {
    name: "超强台风“格美” (Gaemi)",
    year: 2024,
    startDateStr: "2024-07-20T08:00:00",
    description: "2024年大型超强台风，兼具极其广阔的西南季风水汽输送带，先登陆台湾宜兰，再二登福建秀屿，致使东南及华北多省极端强降雨。",
    points: [
      { lat: 15.0, lon: 128.5, vmax: 20, pmin: 995 },
      { lat: 16.5, lon: 126.8, vmax: 30, pmin: 980 },
      { lat: 18.2, lon: 125.5, vmax: 42, pmin: 955 },
      { lat: 20.1, lon: 124.8, vmax: 52, pmin: 935 },
      { lat: 22.8, lon: 123.5, vmax: 58, pmin: 925 },
      { lat: 24.5, lon: 121.8, vmax: 52, pmin: 935 }, // Landfall Yilan
      { lat: 25.2, lon: 119.8, vmax: 38, pmin: 965 }, // Landfall Xiuyu, Fujian
      { lat: 26.8, lon: 118.2, vmax: 25, pmin: 985 },
      { lat: 29.0, lon: 116.0, vmax: 18, pmin: 995 }
    ]
  },
  {
    name: "超强台风“苏拉” (Saola)",
    year: 2023,
    startDateStr: "2023-08-24T08:00:00",
    description: "2023年超强台风，环流异常紧凑强悍。在吕宋海峡画出逆时针大圈后沿广东海岸线精准紧贴掠过并登陆珠海。",
    points: [
      { lat: 20.4, lon: 124.6, vmax: 18, pmin: 998 },
      { lat: 19.8, lon: 124.2, vmax: 33, pmin: 975 },
      { lat: 18.5, lon: 123.5, vmax: 45, pmin: 950 },
      { lat: 17.5, lon: 123.1, vmax: 55, pmin: 930 },
      { lat: 18.2, lon: 124.0, vmax: 62, pmin: 915 },
      { lat: 19.3, lon: 124.5, vmax: 62, pmin: 915 },
      { lat: 20.5, lon: 123.2, vmax: 55, pmin: 930 },
      { lat: 21.0, lon: 121.0, vmax: 62, pmin: 915 },
      { lat: 21.6, lon: 118.5, vmax: 58, pmin: 925 },
      { lat: 21.9, lon: 116.2, vmax: 55, pmin: 930 },
      { lat: 22.0, lon: 114.2, vmax: 48, pmin: 945 },
      { lat: 21.7, lon: 112.9, vmax: 42, pmin: 955 }, // Landfall Zhuhai / Taishan
      { lat: 21.3, lon: 111.4, vmax: 28, pmin: 982 }
    ]
  },
  {
    name: "超强台风“杜苏芮” (Doksuri)",
    year: 2023,
    startDateStr: "2023-07-21T08:00:00",
    description: "2023年强灾害性超强台风。掠过菲律宾后以巅峰强度正面登陆福建晋江，残留云系一路北上引发海河流域特大暴雨。",
    points: [
      { lat: 14.1, lon: 132.8, vmax: 18, pmin: 998 },
      { lat: 14.7, lon: 130.2, vmax: 25, pmin: 985 },
      { lat: 15.3, lon: 127.5, vmax: 35, pmin: 970 },
      { lat: 16.2, lon: 125.6, vmax: 48, pmin: 945 },
      { lat: 17.8, lon: 123.8, vmax: 58, pmin: 925 },
      { lat: 19.3, lon: 121.8, vmax: 62, pmin: 915 },
      { lat: 21.1, lon: 119.5, vmax: 55, pmin: 930 },
      { lat: 23.5, lon: 118.8, vmax: 50, pmin: 935 },
      { lat: 24.6, lon: 118.6, vmax: 50, pmin: 935 }, // Landfall Jinjiang
      { lat: 26.8, lon: 117.8, vmax: 30, pmin: 978 },
      { lat: 29.5, lon: 116.5, vmax: 18, pmin: 994 }
    ]
  },
  {
    name: "强台风“梅花” (Muifa)",
    year: 2022,
    startDateStr: "2022-09-08T08:00:00",
    description: "2022年生命史漫长的台风，四次登陆中国沿海（舟山、奉贤、青岛、大连），刷新我国台风登陆纬度跨度历史记录。",
    points: [
      { lat: 17.2, lon: 132.0, vmax: 20, pmin: 995 },
      { lat: 20.5, lon: 125.8, vmax: 38, pmin: 965 },
      { lat: 24.0, lon: 124.2, vmax: 48, pmin: 945 },
      { lat: 27.2, lon: 123.0, vmax: 42, pmin: 955 },
      { lat: 29.8, lon: 122.3, vmax: 42, pmin: 955 }, // Landfall Zhoushan
      { lat: 31.5, lon: 121.5, vmax: 35, pmin: 970 }, // Landfall Shanghai Fengxian
      { lat: 35.8, lon: 120.2, vmax: 25, pmin: 988 }, // Landfall Qingdao
      { lat: 38.8, lon: 121.8, vmax: 18, pmin: 995 }  // Landfall Dalian
    ]
  },
  {
    name: "强台风“烟花” (In-fa)",
    year: 2021,
    startDateStr: "2021-07-18T08:00:00",
    description: "2021年移速极慢的台风。在东海长时间停滞蓄水，登陆浙江舟山和平湖后陆上维持数十小时，与河南“7·20”特大暴雨远程联动。",
    points: [
      { lat: 22.0, lon: 132.5, vmax: 18, pmin: 998 },
      { lat: 23.8, lon: 128.0, vmax: 33, pmin: 975 },
      { lat: 24.5, lon: 125.2, vmax: 42, pmin: 955 },
      { lat: 26.0, lon: 124.0, vmax: 38, pmin: 965 },
      { lat: 28.2, lon: 122.8, vmax: 38, pmin: 965 },
      { lat: 29.9, lon: 122.3, vmax: 38, pmin: 965 }, // Landfall Zhoushan
      { lat: 30.7, lon: 121.1, vmax: 28, pmin: 980 }, // Landfall Pinghu
      { lat: 32.0, lon: 119.5, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "超强台风“海神” (Haishen)",
    year: 2020,
    startDateStr: "2020-09-01T08:00:00",
    description: "2020年西北太平洋“风王”之一，巅峰风速60m/s。以极高纬度北上直扑日本九州与朝鲜半岛，罕见影响我国东北全境。",
    points: [
      { lat: 20.0, lon: 141.5, vmax: 25, pmin: 985 },
      { lat: 23.5, lon: 136.8, vmax: 45, pmin: 950 },
      { lat: 27.8, lon: 132.2, vmax: 60, pmin: 910 }, // Peak SuperTY
      { lat: 31.2, lon: 129.8, vmax: 48, pmin: 940 }, // Passing Kyushu
      { lat: 35.2, lon: 129.2, vmax: 35, pmin: 965 }, // Landfall Korea Busan
      { lat: 40.5, lon: 129.0, vmax: 20, pmin: 990 }  // Entering Northeast China
    ]
  },
  {
    name: "超强台风“利奇马” (Lekima)",
    year: 2019,
    startDateStr: "2019-08-04T14:00:00",
    description: "2019年登陆我国最强台风。在浙江温岭以52m/s强度登陆，一路北上横扫华东、华北及东北，降雨总量极其罕见。",
    points: [
      { lat: 17.4, lon: 131.9, vmax: 18, pmin: 998 },
      { lat: 18.3, lon: 130.6, vmax: 25, pmin: 985 },
      { lat: 19.5, lon: 129.2, vmax: 33, pmin: 975 },
      { lat: 20.8, lon: 127.8, vmax: 42, pmin: 955 },
      { lat: 22.3, lon: 126.1, vmax: 52, pmin: 935 },
      { lat: 24.1, lon: 124.2, vmax: 62, pmin: 915 },
      { lat: 25.8, lon: 122.4, vmax: 55, pmin: 925 },
      { lat: 27.5, lon: 121.5, vmax: 52, pmin: 930 },
      { lat: 28.3, lon: 121.1, vmax: 52, pmin: 930 }, // Landfall Wenling, Zhejiang
      { lat: 30.1, lon: 120.6, vmax: 28, pmin: 980 },
      { lat: 32.5, lon: 120.1, vmax: 20, pmin: 992 },
      { lat: 35.1, lon: 120.2, vmax: 23, pmin: 988 }, // Landfall Qingdao
      { lat: 39.0, lon: 121.2, vmax: 12, pmin: 1002 }
    ]
  },
  {
    name: "超强台风“山竹” (Mangkhut)",
    year: 2018,
    startDateStr: "2018-09-11T08:00:00",
    description: "2018年世纪超强台风。环流半径超过千公里，以极其强悍姿态登陆广东台山，引发香港、澳门及珠三角全面停工停课暴风潮。",
    points: [
      { lat: 13.4, lon: 141.0, vmax: 35, pmin: 970 },
      { lat: 13.8, lon: 138.8, vmax: 42, pmin: 955 },
      { lat: 14.1, lon: 136.2, vmax: 50, pmin: 940 },
      { lat: 14.4, lon: 133.5, vmax: 58, pmin: 925 },
      { lat: 14.9, lon: 130.4, vmax: 65, pmin: 905 },
      { lat: 15.4, lon: 127.1, vmax: 65, pmin: 905 },
      { lat: 15.9, lon: 124.0, vmax: 65, pmin: 905 },
      { lat: 16.7, lon: 120.3, vmax: 58, pmin: 925 },
      { lat: 18.2, lon: 117.8, vmax: 50, pmin: 940 },
      { lat: 19.8, lon: 115.3, vmax: 48, pmin: 945 },
      { lat: 21.8, lon: 112.5, vmax: 45, pmin: 950 }, // Landfall Taishan
      { lat: 23.1, lon: 109.8, vmax: 28, pmin: 980 }
    ]
  },
  {
    name: "强台风“天鸽” (Hato)",
    year: 2017,
    startDateStr: "2017-08-20T08:00:00",
    description: "2017年近岸爆发强台风，在珠江口爆发性增强，正面重创香港、澳门与珠海，引发澳门罕见严重风暴潮与水灾。",
    points: [
      { lat: 20.0, lon: 128.0, vmax: 20, pmin: 995 },
      { lat: 20.4, lon: 124.2, vmax: 28, pmin: 985 },
      { lat: 20.8, lon: 120.0, vmax: 35, pmin: 975 },
      { lat: 21.3, lon: 116.5, vmax: 42, pmin: 960 },
      { lat: 21.9, lon: 113.8, vmax: 48, pmin: 950 }, // Rapid intensification near Pearl River Delta
      { lat: 22.1, lon: 113.2, vmax: 45, pmin: 955 }, // Landfall Zhuhai Jinwan
      { lat: 22.8, lon: 110.2, vmax: 25, pmin: 985 }
    ]
  },
  {
    name: "超强台风“莫兰蒂” (Meranti)",
    year: 2016,
    startDateStr: "2016-09-10T08:00:00",
    description: "2016年全球“风王”，巅峰风速75m/s（17级以上），气压890hPa。掠过台湾南部后以52m/s正面强登陆厦门，重创厦漳泉地区。",
    points: [
      { lat: 15.0, lon: 138.0, vmax: 30, pmin: 980 },
      { lat: 17.2, lon: 130.5, vmax: 55, pmin: 925 },
      { lat: 19.5, lon: 124.0, vmax: 75, pmin: 890 }, // Peak World SuperTY
      { lat: 21.2, lon: 120.8, vmax: 68, pmin: 905 },
      { lat: 23.2, lon: 119.0, vmax: 58, pmin: 925 },
      { lat: 24.5, lon: 118.1, vmax: 52, pmin: 940 }, // Landfall Xiamen Xiang'an
      { lat: 26.5, lon: 117.2, vmax: 25, pmin: 985 }
    ]
  },
  {
    name: "超强台风“苏迪罗” (Soudelor)",
    year: 2015,
    startDateStr: "2015-08-01T08:00:00",
    description: "2015年全球强台风，先后登陆台湾花莲与福建秀屿，强风暴雨致使台湾及东南沿海多省出现特大山洪与城市内涝。",
    points: [
      { lat: 14.5, lon: 145.0, vmax: 30, pmin: 980 },
      { lat: 17.8, lon: 136.0, vmax: 60, pmin: 915 },
      { lat: 19.5, lon: 130.0, vmax: 68, pmin: 900 },
      { lat: 21.8, lon: 125.0, vmax: 55, pmin: 930 },
      { lat: 23.8, lon: 121.6, vmax: 48, pmin: 945 }, // Landfall Hualien
      { lat: 25.2, lon: 119.1, vmax: 38, pmin: 968 }, // Landfall Putian Xiuyu
      { lat: 27.5, lon: 116.8, vmax: 20, pmin: 990 }
    ]
  },
  {
    name: "超强台风“威马逊” (Rammasun)",
    year: 2014,
    startDateStr: "2014-07-12T08:00:00",
    description: "建国以来登陆我国陆地的最强台风（70m/s，17级以上）。先后登陆海南文昌、广东徐闻及广西防城港，毁灭性风灾破坏力极大。",
    points: [
      { lat: 12.0, lon: 135.0, vmax: 20, pmin: 995 },
      { lat: 13.5, lon: 124.0, vmax: 42, pmin: 960 },
      { lat: 15.2, lon: 118.0, vmax: 38, pmin: 968 },
      { lat: 17.0, lon: 114.5, vmax: 45, pmin: 955 },
      { lat: 18.8, lon: 111.8, vmax: 60, pmin: 915 },
      { lat: 19.6, lon: 110.9, vmax: 70, pmin: 899 }, // Landfall Wenchang Peak
      { lat: 20.3, lon: 110.1, vmax: 62, pmin: 910 }, // Landfall Xuwen
      { lat: 21.5, lon: 108.2, vmax: 50, pmin: 940 }  // Landfall Fangchenggang
    ]
  },
  {
    name: "超强台风“海燕” (Haiyan)",
    year: 2013,
    startDateStr: "2013-11-03T08:00:00",
    description: "人类观测史上陆地登陆风速最高的超强台风之一（78m/s，895hPa）。毁灭性重创菲律宾塔克洛班后进入南海北部影响桂粤。",
    points: [
      { lat: 6.5, lon: 152.0, vmax: 25, pmin: 985 },
      { lat: 8.2, lon: 142.0, vmax: 55, pmin: 925 },
      { lat: 10.5, lon: 129.0, vmax: 78, pmin: 895 }, // Peak SuperTY
      { lat: 11.2, lon: 125.0, vmax: 75, pmin: 900 }, // Landfall Samar/Leyte
      { lat: 14.0, lon: 116.0, vmax: 48, pmin: 945 },
      { lat: 18.5, lon: 109.0, vmax: 38, pmin: 965 },
      { lat: 21.2, lon: 107.5, vmax: 30, pmin: 978 }
    ]
  },
  {
    name: "超强台风“布拉万” (Bolaven)",
    year: 2012,
    startDateStr: "2012-08-20T08:00:00",
    description: "2012年大型强台风。以巨大环流沿我国东海一路高速北上，先后袭击济州岛、朝鲜半岛与我国东北三省。",
    points: [
      { lat: 17.5, lon: 142.0, vmax: 20, pmin: 995 },
      { lat: 22.0, lon: 133.0, vmax: 45, pmin: 950 },
      { lat: 26.5, lon: 127.5, vmax: 55, pmin: 925 },
      { lat: 31.0, lon: 125.5, vmax: 48, pmin: 945 },
      { lat: 33.5, lon: 125.0, vmax: 38, pmin: 960 },
      { lat: 38.0, lon: 125.8, vmax: 28, pmin: 980 }, // Landfall DPRK/Korea
      { lat: 43.0, lon: 127.5, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "强台风“梅花” (Muifa 2011)",
    year: 2011,
    startDateStr: "2011-07-28T08:00:00",
    description: "2011年“梅花三弄”强台风，在华东沿海引发高强度防风警报，沿山东半岛外侧北上登陆朝鲜半岛。",
    points: [
      { lat: 13.0, lon: 138.0, vmax: 20, pmin: 995 },
      { lat: 20.0, lon: 133.0, vmax: 48, pmin: 945 },
      { lat: 25.5, lon: 127.0, vmax: 52, pmin: 935 },
      { lat: 29.0, lon: 124.5, vmax: 42, pmin: 955 },
      { lat: 34.0, lon: 123.0, vmax: 30, pmin: 975 },
      { lat: 38.5, lon: 124.5, vmax: 22, pmin: 988 }
    ]
  },
  {
    name: "强台风“凡亚比” (Fanapi)",
    year: 2010,
    startDateStr: "2010-09-15T08:00:00",
    description: "2010年严重灾害性台风。登陆台湾花莲后再登福建漳浦，引爆粤西阳江、茂名特大山洪暴雨泥石流。",
    points: [
      { lat: 20.0, lon: 127.5, vmax: 20, pmin: 995 },
      { lat: 22.5, lon: 125.0, vmax: 42, pmin: 955 },
      { lat: 23.8, lon: 121.5, vmax: 48, pmin: 945 }, // Landfall Taiwan Hualien
      { lat: 23.6, lon: 117.6, vmax: 38, pmin: 965 }, // Landfall Fujian Zhangpu
      { lat: 23.2, lon: 113.5, vmax: 20, pmin: 990 }
    ]
  },
  {
    name: "强台风“莫拉克” (Morakot)",
    year: 2009,
    startDateStr: "2009-08-04T08:00:00",
    description: "2009年引发台湾“八八水灾”的特大灾害台风，降雨突破2000毫米，登陆福建霞浦后致东南多省严重水患。",
    points: [
      { lat: 21.0, lon: 136.0, vmax: 20, pmin: 995 },
      { lat: 23.0, lon: 128.0, vmax: 35, pmin: 970 },
      { lat: 24.0, lon: 122.5, vmax: 42, pmin: 955 },
      { lat: 24.2, lon: 121.5, vmax: 40, pmin: 960 }, // Landfall Taiwan Hualien
      { lat: 26.8, lon: 120.0, vmax: 33, pmin: 972 }, // Landfall Fujian Xiapu
      { lat: 28.5, lon: 119.0, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "超强台风“蔷薇” (Jangmi)",
    year: 2008,
    startDateStr: "2008-09-24T08:00:00",
    description: "2008年西北太平洋最强台风（60m/s），以超强台风巅峰姿态登陆台湾宜兰，破坏力极大。",
    points: [
      { lat: 15.5, lon: 138.0, vmax: 20, pmin: 995 },
      { lat: 19.5, lon: 128.0, vmax: 48, pmin: 945 },
      { lat: 22.8, lon: 123.5, vmax: 60, pmin: 915 }, // Peak SuperTY
      { lat: 24.4, lon: 121.8, vmax: 55, pmin: 925 }, // Landfall Yilan
      { lat: 26.5, lon: 121.2, vmax: 28, pmin: 980 }
    ]
  },
  {
    name: "超强台风“柯罗莎” (Krosa)",
    year: 2007,
    startDateStr: "2007-10-02T08:00:00",
    description: "2007年国庆期间强袭击台风，在台湾宜兰打转后登陆浙江苍南，给浙闽沪带来狂风巨浪。",
    points: [
      { lat: 16.0, lon: 133.0, vmax: 20, pmin: 995 },
      { lat: 20.0, lon: 127.0, vmax: 45, pmin: 950 },
      { lat: 23.5, lon: 123.0, vmax: 55, pmin: 925 },
      { lat: 24.8, lon: 121.9, vmax: 50, pmin: 935 }, // Landfall Taiwan Yilan
      { lat: 27.5, lon: 120.5, vmax: 33, pmin: 970 }, // Landfall Cangnan, Zhejiang
      { lat: 29.5, lon: 121.5, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "超强台风“桑美” (Saomai 2006)",
    year: 2006,
    startDateStr: "2006-08-05T08:00:00",
    description: "建国以来登陆我国华东的最强台风（60m/s，17级）。正面极强登陆浙江苍南马站，重创浙南闽北。",
    points: [
      { lat: 16.0, lon: 140.0, vmax: 20, pmin: 995 },
      { lat: 21.0, lon: 131.0, vmax: 42, pmin: 955 },
      { lat: 25.5, lon: 123.5, vmax: 60, pmin: 915 }, // Peak SuperTY
      { lat: 27.3, lon: 120.5, vmax: 60, pmin: 915 }, // Landfall Cangnan Mazhan
      { lat: 28.2, lon: 117.5, vmax: 20, pmin: 990 }
    ]
  },
  {
    name: "超强台风“海棠” (Haitang)",
    year: 2005,
    startDateStr: "2005-07-12T08:00:00",
    description: "2005年双登陆强台风。双眼墙结构，先后登陆台湾花莲与福建连江，给东南沿海带来长时间特大暴雨。",
    points: [
      { lat: 18.0, lon: 145.0, vmax: 20, pmin: 995 },
      { lat: 21.0, lon: 131.0, vmax: 48, pmin: 945 },
      { lat: 23.8, lon: 124.0, vmax: 58, pmin: 920 },
      { lat: 24.2, lon: 121.7, vmax: 50, pmin: 935 }, // Landfall Hualien
      { lat: 26.3, lon: 119.6, vmax: 38, pmin: 965 }, // Landfall Lianjiang, Fujian
      { lat: 28.0, lon: 117.0, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "强台风“云娜” (Rananim)",
    year: 2004,
    startDateStr: "2004-08-08T08:00:00",
    description: "2004年登陆浙江最强台风之一。在浙江温岭以45m/s强度正面登陆，深入内陆给浙沪赣带来极强风雨。",
    points: [
      { lat: 20.0, lon: 136.0, vmax: 20, pmin: 995 },
      { lat: 23.5, lon: 128.0, vmax: 38, pmin: 965 },
      { lat: 27.0, lon: 123.0, vmax: 45, pmin: 950 },
      { lat: 28.3, lon: 121.3, vmax: 45, pmin: 950 }, // Landfall Wenling
      { lat: 29.5, lon: 118.5, vmax: 25, pmin: 985 }
    ]
  },
  {
    name: "超强台风“鸣蝉” (Maemi)",
    year: 2003,
    startDateStr: "2003-09-06T08:00:00",
    description: "2003年韩国灾难性超强台风，巅峰风速60m/s，重创济州岛并正面登陆釜山，创下韩国最低气压纪录。",
    points: [
      { lat: 18.0, lon: 138.0, vmax: 20, pmin: 995 },
      { lat: 23.0, lon: 128.0, vmax: 50, pmin: 940 },
      { lat: 28.0, lon: 125.5, vmax: 60, pmin: 910 }, // Peak SuperTY
      { lat: 33.3, lon: 126.5, vmax: 48, pmin: 940 }, // Passing Jeju
      { lat: 35.1, lon: 129.0, vmax: 42, pmin: 950 }  // Landfall Busan
    ]
  },
  {
    name: "超强台风“查特安” (Chataan)",
    year: 2002,
    startDateStr: "2002-06-28T08:00:00",
    description: "2002年早夏强台风，袭击关岛后在密克罗尼西亚及日本本州沿海带来大范围强风暴雨。",
    points: [
      { lat: 8.0, lon: 152.0, vmax: 20, pmin: 995 },
      { lat: 13.5, lon: 144.8, vmax: 42, pmin: 955 }, // Hitting Guam
      { lat: 20.0, lon: 138.0, vmax: 55, pmin: 925 },
      { lat: 28.0, lon: 135.0, vmax: 45, pmin: 945 },
      { lat: 35.0, lon: 140.0, vmax: 30, pmin: 975 }  // Landfall Honshu Japan
    ]
  },
  {
    name: "强台风“桃芝” (Toraji)",
    year: 2001,
    startDateStr: "2001-07-27T08:00:00",
    description: "2001年台湾重大山洪灾害台风，横穿台湾花莲南投后登陆福建连江，致使台湾日月潭与南投暴发严重泥石流。",
    points: [
      { lat: 19.0, lon: 127.0, vmax: 20, pmin: 995 },
      { lat: 21.5, lon: 124.0, vmax: 38, pmin: 965 },
      { lat: 23.8, lon: 121.6, vmax: 45, pmin: 950 }, // Landfall Hualien
      { lat: 26.2, lon: 119.6, vmax: 30, pmin: 978 }, // Landfall Lianjiang
      { lat: 28.0, lon: 117.5, vmax: 18, pmin: 992 }
    ]
  },
  {
    name: "超强台风“桑美” (Saomai 2000)",
    year: 2000,
    startDateStr: "2000-09-02T08:00:00",
    description: "2000年跨越极长生命史的超强台风，在东海打出巨大弧形轨迹，袭击日本冲绳后直扑韩国和朝鲜半岛。",
    points: [
      { lat: 18.0, lon: 142.0, vmax: 20, pmin: 995 },
      { lat: 22.5, lon: 132.0, vmax: 50, pmin: 940 },
      { lat: 26.0, lon: 126.8, vmax: 55, pmin: 925 },
      { lat: 30.0, lon: 125.0, vmax: 42, pmin: 955 },
      { lat: 35.0, lon: 128.5, vmax: 30, pmin: 975 }  // Landfall Korea
    ]
  }
];

/**
 * Calculates distance (km) between two lat/lon pairs
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts historical typhoon data into simulation Typhoon format.
 * Requirement 8: Sets interval to 3-hour steps for high-precision historical dot tracking!
 */
export function convertToSimulationTyphoon(hist: HistoricalTyphoonData, intervalHours: number = 3): Typhoon {
  const points = hist.points;
  
  const historyStates: TyphoonState[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const simHour = i * intervalHours;

    // 1. Calculate direction & speed
    let speed = 20.0; // default in km/h
    let direction = 295; // default WNW
    if (i < points.length - 1) {
      const nextPt = points[i + 1];
      const dist = getDistanceKm(pt.lat, pt.lon, nextPt.lat, nextPt.lon);
      speed = Number((dist / intervalHours).toFixed(1));
      
      const dy = nextPt.lat - pt.lat;
      const dx = (nextPt.lon - pt.lon) * Math.cos((pt.lat * Math.PI) / 180);
      let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      direction = Math.round(angle);
    } else if (i > 0) {
      const prevPt = points[i - 1];
      const dist = getDistanceKm(prevPt.lat, prevPt.lon, pt.lat, pt.lon);
      speed = Number((dist / intervalHours).toFixed(1));
      
      const dy = pt.lat - prevPt.lat;
      const dx = (pt.lon - prevPt.lon) * Math.cos((prevPt.lat * Math.PI) / 180);
      let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      direction = Math.round(angle);
    }

    // 2. Pressure (pmin) - use formula if missing
    let pmin = pt.pmin;
    if (!pmin) {
      const ratio = Math.max(0.0, Math.min(1.0, (pt.vmax - 17.2) / 55.0));
      pmin = Math.round(1002 - ratio * 95);
    }

    // 3. Category
    let category = TyphoonCategory.TD;
    if (pt.vmax >= 17.2 && pt.vmax < 24.5) category = TyphoonCategory.TS;
    else if (pt.vmax >= 24.5 && pt.vmax < 32.7) category = TyphoonCategory.STS;
    else if (pt.vmax >= 32.7 && pt.vmax < 41.5) category = TyphoonCategory.TY;
    else if (pt.vmax >= 41.5 && pt.vmax < 51.0) category = TyphoonCategory.STY;
    else if (pt.vmax >= 51.0) category = TyphoonCategory.SuperTY;

    // 4. Wind circles (R7, R10, R12)
    const baseR7 = Math.round(140 + (pt.vmax - 17.2) * 4.2);
    const r7 = pt.r7 || {
      ne: Math.round(baseR7 * 1.1),
      se: Math.round(baseR7 * 1.15),
      sw: Math.round(baseR7 * 0.9),
      nw: Math.round(baseR7 * 0.95)
    };

    const r10 = {
      ne: Math.round(r7.ne * 0.6),
      se: Math.round(r7.se * 0.6),
      sw: Math.round(r7.sw * 0.6),
      nw: Math.round(r7.nw * 0.6)
    };

    const r12 = {
      ne: Math.round(r7.ne * 0.45),
      se: Math.round(r7.se * 0.45),
      sw: Math.round(r7.sw * 0.45),
      nw: Math.round(r7.nw * 0.45)
    };

    const rmw = Math.max(15, Math.round(45 - (pt.vmax - 17.2) * 0.3));

    const state: TyphoonState = {
      lat: pt.lat,
      lon: pt.lon,
      vmax: pt.vmax,
      pmin: pmin,
      direction,
      speed,
      rmw,
      r7,
      r10,
      r12,
      category,
      simHour,
      landed: pt.lat > 20 && pt.lon < 122 && pt.lon > 110,
      dissipated: i === points.length - 1 && pt.vmax < 15.0,
      extrTransition: pt.lat >= 30.0 ? 0.95 : 0.0,
      ewrcState: "none",
      ewrcProgress: 0,
      rapidIntensifying: pt.vmax >= 45 && i > 0 && pt.vmax - points[i - 1].vmax >= 15,
      isManualSteering: false,
      lastVelocityU: 0,
      lastVelocityV: 0
    };

    historyStates.push(state);
  }

  // Current state is the last point
  const lastState = historyStates[historyStates.length - 1];
  const maxHour = (points.length - 1) * intervalHours;

  return {
    id: `historical-${Date.now()}-${hist.year}`,
    name: hist.name,
    lat: lastState.lat,
    lon: lastState.lon,
    vmax: lastState.vmax,
    pmin: lastState.pmin,
    direction: lastState.direction,
    speed: lastState.speed,
    rmw: lastState.rmw,
    r7: lastState.r7,
    r10: lastState.r10,
    r12: lastState.r12,
    active: !lastState.dissipated,
    category: lastState.category,
    landed: lastState.landed,
    dissipated: lastState.dissipated,
    extrTransition: lastState.extrTransition,
    ewrcState: "none",
    ewrcProgress: 0,
    rapidIntensifying: lastState.rapidIntensifying,
    history: historyStates,
    simHour: maxHour,
    forecastPath: []
  };
}
