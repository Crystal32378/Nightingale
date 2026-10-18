/**
 * Nightingale — Google track demo config (NTUH, first route).
 *
 * Locked 2026-09-22 from live Places + Routes API responses (project
 * walk-me-there). Verified against the NTUH official traffic page
 * (Fpage.action?fid=2984&muid=3231): 西址 = 常德街1號, 門診住院.
 *
 * Live route (Taipei Main Station -> NTUH 西址, TRANSIT):
 *   MRT 台北車站 -> 台大醫院站 -> 從2出口出站 (104m) -> 往東 -> 向左轉,
 *   目的地在左邊 (49m). Egress walk ~158m.
 *
 * Accessibility notes (field-verified by Crystal, Sep 2026回診;
 * registry web source still to be added before submission):
 *  - 台大醫院站 2號出口有無障礙電梯 (常德街公園路口)
 *  - 西址正門側邊有坡道上去
 *  - 東址正門側邊有坡道上去; 常德街人行地下連通道直通東址 (2024/3/29啟用)
 */

export const DEMO_HOSPITAL_PLACE_ID = 'ChIJa6ODh3OpQjQRS5S20fKaUTY'
export const DEMO_HOSPITAL_NAME = '國立臺灣大學醫學院附設醫院西址'
export const DEMO_HOSPITAL_ADDRESS = '100台灣臺北市中正區黎明里常德街1號'
export const DEMO_EGRESS_EXIT = '2號出口'
