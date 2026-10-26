import type { Department } from './tpech'

/**
 * Our English for the hospital's official Chinese names. The hospital's own
 * English site (webreg.tpech.gov.tw/eng/) answers 404, so these are a
 * translation awaiting review, never shown without the official name beside
 * them. First entry is shown; the rest only help English searches find it.
 * A name not listed here is still found by its Chinese name.
 */
export const DEPARTMENT_EN: Record<string, string[]> = {
  一般內科: ['General Internal Medicine', 'internal medicine'],
  內分泌及新陳代謝科: ['Endocrinology and Metabolism', 'diabetes', 'thyroid'],
  心臟血管內科: ['Cardiology', 'heart'],
  血液腫瘤科: ['Hematology and Oncology', 'cancer', 'blood'],
  放射線腫瘤科: ['Radiation Oncology', 'cancer', 'radiotherapy'],
  消化內科: ['Gastroenterology', 'stomach', 'digestive'],
  神經內科: ['Neurology', 'nerve', 'brain'],
  胸腔內科: ['Chest Medicine', 'lung', 'pulmonology'],
  復健科: ['Rehabilitation', 'physical therapy'],
  腎臟內科: ['Nephrology', 'kidney'],
  感染科: ['Infectious Diseases', 'infection'],
  過敏免疫風濕科: ['Allergy, Immunology and Rheumatology', 'allergy', 'rheumatology'],
  營養諮詢: ['Nutrition Counseling', 'diet'],
  一般外科: ['General Surgery', 'surgery'],
  心臟血管外科: ['Cardiovascular Surgery', 'heart'],
  甲狀腺外科: ['Thyroid Surgery', 'thyroid'],
  皮膚科: ['Dermatology', 'skin'],
  耳鼻喉科: ['Otolaryngology (ENT)', 'ear', 'nose', 'throat'],
  乳房門診: ['Breast Clinic', 'breast'],
  泌尿科: ['Urology', 'bladder'],
  神經外科: ['Neurosurgery', 'brain', 'spine'],
  胸腔外科: ['Thoracic Surgery', 'chest', 'lung'],
  骨科: ['Orthopedics', 'bone', 'joint'],
  眼科: ['Ophthalmology', 'eye'],
  整形外科: ['Plastic Surgery'],
  '小兒科/健兒門診': ['Pediatrics / Well-Child Clinic', 'children', 'child', 'kids'],
  小兒科: ['Pediatrics', 'children', 'child', 'kids'],
  婦產科: ['Obstetrics and Gynecology', 'women', 'pregnancy', 'gynecology'],
  家庭醫學科: ['Family Medicine', 'general practice', 'GP'],
  精神科: ['Psychiatry', 'mental health'],
  牙科: ['Dentistry', 'dental', 'teeth', 'tooth'],
  中醫內科: ['Chinese Medicine: Internal Medicine', 'TCM'],
  中醫針灸: ['Chinese Medicine: Acupuncture', 'acupuncture', 'TCM'],
  '中醫婦(兒)科': ['Chinese Medicine: Gynecology and Pediatrics', 'TCM'],
  '中醫傷(皮膚)科': ['Chinese Medicine: Traumatology and Dermatology', 'TCM'],
  門診體檢: ['Outpatient Health Check', 'checkup'],
}

/** The ten main campuses; outpatient branches keep their Chinese name only. */
export const CAMPUS_EN: Record<string, string> = {
  仁愛院區: 'Renai Branch',
  中興院區: 'Zhongxing Branch',
  和平院區: 'Heping Branch',
  婦幼院區: 'Fuyou Branch',
  林森院區: 'Linsen Branch',
  陽明院區: 'Yangming Branch',
  忠孝院區: 'Zhongxiao Branch',
  松德院區: 'Songde Branch',
  昆明院區: 'Kunming Branch',
  中醫中心: 'Chinese Medicine Center',
}

const own = (table: Record<string, string[]>, name: string) =>
  Object.prototype.hasOwnProperty.call(table, name) ? table[name] : []

export const englishName = (name: string): string | undefined => own(DEPARTMENT_EN, name)[0]

/** Chinese or English, any part of the name; blank shows everything. */
export function findDepartments(departments: Department[], query: string): Department[] {
  const q = query.trim().toLowerCase()
  if (!q) return departments
  return departments.filter((d) => [d.name, ...own(DEPARTMENT_EN, d.name)].some((term) => term.toLowerCase().includes(q)))
}
