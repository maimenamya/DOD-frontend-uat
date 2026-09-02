export type GuideNavLine = {
  label: string;
  kind: 'link' | 'section' | 'group' | 'child';
  active?: boolean;
};

export type GuideMockField = {
  pin: number;
  label: string;
  sample: string;
  kind?: 'dropdown' | 'input' | 'toggle';
  on?: boolean;
};

export type GuideMockScreen = {
  pageTitle: string;
  addButton?: string;
  addButtonPin?: number;
  chips?: string[];
  activeChip?: string;
  fields: GuideMockField[];
  primaryAction: string;
};

export type GuideSwipeActionKind = 'edit' | 'stop' | 'return' | 'withdraw' | 'trash';
export type GuideSwipeActionTone = 'accent' | 'warning' | 'danger';

export type GuideSwipeAction = {
  kind: GuideSwipeActionKind;
  label: string;
  tone: GuideSwipeActionTone;
};

export type GuideSwipeDemoRow = {
  hint: string;
  reveal: 'right' | 'left';
  title: string;
  meta: string;
  price?: string;
  actions: GuideSwipeAction[];
};

export type GuideSwipeDemo = {
  caption: string;
  legend: GuideSwipeAction[];
  rows: GuideSwipeDemoRow[];
};

export type GuidePosSeatStatus = 'empty' | 'reserved' | 'open' | 'wait';

export type GuidePosPreview = {
  kind: 'floor' | 'bill' | 'add';
  pageTitle: string;
  /** When set, the mock is a POS modal (เพิ่มรายการ / เช็กบิล) not an inline panel. */
  modalTitle?: string;
  seats?: Array<{ code: string; status: GuidePosSeatStatus; pin?: number }>;
  chips?: string[];
  activeChip?: string;
  segments?: { options: string[]; active: string };
  billLines?: Array<{ title: string; meta: string; price: string }>;
  fields?: GuideMockField[];
  primaryAction?: string;
  secondaryAction?: string;
};

export type GuideSidebarIcon =
  | 'dashboard'
  | 'attendance'
  | 'open-table'
  | 'package'
  | 'tag'
  | 'drink-payout'
  | 'history'
  | 'report'
  | 'expense'
  | 'bell'
  | 'employees'
  | 'shield-check'
  | 'drinks'
  | 'food'
  | 'seatings'
  | 'marketing'
  | 'more'
  | 'stock'
  | 'shop-rules';

export type GuideSidebarLink = {
  label: string;
  icon: GuideSidebarIcon;
  pin?: number;
};

export type GuideSidebarGroup = {
  label: string;
  icon: GuideSidebarIcon;
  pin?: number;
  children: Array<{ label: string; pin?: number }>;
};

export type GuideSidebarPreview = {
  links?: GuideSidebarLink[];
  sectionLabel?: string;
  groups?: GuideSidebarGroup[];
};

export type GuidePhoneRow = {
  pin: number;
  label: string;
  slot: 'toolbar' | 'sheet' | 'menu' | 'home';
};

export type GuidePhonePreview = {
  os: 'ios' | 'android' | 'home' | 'notify';
  browser: string;
  caption?: string;
  rows: GuidePhoneRow[];
};

export type GuideWalkthroughBeat = {
  title: string;
  pathLabel?: string;
  route?: string;
  doThis: string[];
  nav?: GuideNavLine[];
  screen?: GuideMockScreen;
  posPreview?: GuidePosPreview;
  sidebarPreview?: GuideSidebarPreview;
  swipeDemo?: GuideSwipeDemo;
  phonePreview?: GuidePhonePreview;
  warn?: string;
  image?: {
    src: string;
    alt: string;
    caption: string;
  };
  storeLink?: {
    href: string;
    label: string;
  };
};

export type GuideWalkthroughChapter = {
  n: number;
  title: string;
  blurb: string;
  optional?: boolean;
  beats: GuideWalkthroughBeat[];
};

const NAV_MGMT_HEAD: GuideNavLine[] = [
  { label: 'POS', kind: 'link' },
  { label: 'การจัดการ', kind: 'section' },
];

const NAV_PROMO_MEM = [
  ...NAV_MGMT_HEAD,
  { label: 'โปร/เมม', kind: 'group' as const, active: true },
];

const PACKAGE_TOGGLE_DO: string[] = [
  'ฟรีมิกซ์เซอร์ เปิด = พอลงแพ็กนี้บนบิลแล้ว สั่งโซดา/น้ำแข็งจากกลุ่มมิกซ์เซอร์ได้ฟรี ทั้งตอนเปิดโต๊ะและตอนลูกค้าสแกน QR — ปิดแล้วมิกซ์คิดเงินตามราคา',
  'ฝากได้ เปิด = ขวดที่ยังไม่เปิดในแพ็กฝากไว้ แล้วเบิกคืนได้ที่เมนูฝากขวด — ปิดแล้วใช้ในบิลนั้นจบ ไม่ฝากต่อ',
  'สำหรับพนักงาน เปิด = ลูกค้าสแกน QR ไม่เห็นแพ็กนี้ พนักงานลงจากหน้าเปิดโต๊ะได้ตามปกติ',
  'จำนวนฟรี PR ดริ้งก์ ไม่ใช่สวิตช์ เป็นตัวเลข — โควต้าดื่มฟรีให้เด็กนั่งดริ้งเมื่อมีแพ็กนี้บนบิล ใส่ 0 ถ้าไม่ให้',
];

const PACKAGE_TOGGLE_FIELDS: GuideMockField[] = [
  { pin: 1, label: 'ฟรีมิกซ์เซอร์', sample: 'เปิด = สั่งมิกซ์ฟรีเมื่อมีแพ็กบนบิล', kind: 'toggle', on: true },
  { pin: 2, label: 'ฝากได้', sample: 'เปิด = ฝากขวดเหลือแล้วเบิกคืนได้', kind: 'toggle', on: true },
  { pin: 3, label: 'สำหรับพนักงาน', sample: 'เปิด = ลูกค้าสแกน QR ไม่เห็น', kind: 'toggle', on: false },
  { pin: 4, label: 'จำนวนฟรี PR ดริ้งก์', sample: 'เช่น 0 หรือ 4', kind: 'input' },
];

const HOMESCREEN_CHAPTER: GuideWalkthroughChapter = {
  n: 1,
  title: 'ไอคอนมือถือและแจ้งเตือน',
    blurb:
    'ไม่บังคับถ้าแค่เปิดเว็บ — แต่ถ้าอยากให้เครื่องดังเมื่อมีออเดอร์หรือถูกเรียก ไอโฟนต้องติดไอคอนแล้วเปิดจากไอคอนนั้น',
  optional: true,
  beats: [
    {
      title: 'ทำไมถึงติดไอคอน — และเมื่อไหร่ไม่ต้องทำ',
      doThis: [
        'ติดไอคอนที่หน้าจอโฮมแล้ว กดเข้า D-rink ได้ทันที ไม่ต้องหาลิงก์ร้านทุกครั้งที่เริ่มงาน',
        'เปิดเต็มจอ ถือมือถือลงบิลสะดวกกว่าเปิดแท็บเบราว์เซอร์',
        'ไอโฟนถ้าอยากให้เครื่องดังเมื่อมีออเดอร์ ต้องติดไอคอนแล้วเปิดจากไอคอนนั้น — เปิดแท็บ Safari อย่างเดียวรับแจ้งเตือนเครื่องไม่ได้',
        'ไม่จำเป็นต้องทำ ถ้าเปิดลิงก์ร้านในเว็บได้ปกติ และไม่ต้องให้เครื่องดังตอนพับจอ',
        'ต้องเปิดลิงก์จากเจ้าของร้านก่อน (มี ?shop= ในลิงก์) แล้วค่อยเพิ่มไอคอน — อย่าล้างข้อมูลเว็บก่อนติดตั้ง',
      ],
      phonePreview: {
        os: 'home',
        browser: 'หน้าจอโฮม',
        caption: 'กดไอคอน D-rink บนหน้าจอโฮม — เหมือนเปิดแอพ',
        rows: [{ pin: 1, label: 'D-rink', slot: 'home' }],
      },
    },
    {
      title: 'iPhone / iPad — ใช้ Safari เท่านั้น',
      doThis: [
        'เปิดลิงก์ร้านใน Safari — อย่าใช้ Chrome บนไอโฟน ติดไอคอนจาก Chrome แล้วเข้า POS ไม่ครบ',
        'กดปุ่มแชร์ด้านล่าง (สี่เหลี่ยมมีลูกศรขึ้น)',
        'เลื่อนหา เพิ่มไปยังหน้าจอโฮม แล้วกด เพิ่ม',
        'กลับไปหน้าจอโฮม จะมีไอคอน D-rink — กดอันนั้นตอนเข้างาน แล้วค่อยเปิดแจ้งเตือนเครื่อง (ขั้น 1.4)',
      ],
      phonePreview: {
        os: 'ios',
        browser: 'Safari',
        caption: 'iPhone ต้องใช้ Safari — กดแชร์ แล้วเลือกเพิ่มไปยังหน้าจอโฮม',
        rows: [
          { pin: 1, label: 'แชร์', slot: 'toolbar' },
          { pin: 2, label: 'เพิ่มไปยังหน้าจอโฮม', slot: 'sheet' },
          { pin: 3, label: 'เพิ่ม', slot: 'sheet' },
        ],
      },
      warn: 'ยังไม่มีลิงก์ร้าน — ขอจากเจ้าของร้านก่อน เปิดใน Safari ให้ขึ้นหน้าเข้าสู่ระบบ แล้วค่อยติดไอคอน',
    },
    {
      title: 'Android — ใช้ Chrome',
      doThis: [
        'เปิดลิงก์ร้านใน Chrome — อย่าเปิดจากไลน์ แจ้งเตือนเครื่องใช้ไม่ได้',
        'กดจุดสามจุด ⋮ มุมขวาบน',
        'เลือก เพิ่มไปยังหน้าจอหลัก หรือ ติดตั้งแอป แล้วกด เพิ่ม / ติดตั้ง',
        'กลับไปหน้าจอโฮม กดไอคอน D-rink ตอนเข้างาน แล้วค่อยเปิดแจ้งเตือนเครื่อง (ขั้น 1.4)',
      ],
      phonePreview: {
        os: 'android',
        browser: 'Chrome',
        caption: 'Android ใช้ Chrome — กด ⋮ แล้วเลือกเพิ่มไปยังหน้าจอหลัก',
        rows: [
          { pin: 1, label: '⋮', slot: 'menu' },
          { pin: 2, label: 'เพิ่มไปยังหน้าจอหลัก', slot: 'sheet' },
          { pin: 3, label: 'ติดตั้ง', slot: 'sheet' },
        ],
      },
    },
    {
      title: 'เปิดแจ้งเตือนเครื่อง — คนที่มีกระดิ่งมุมบน',
      doThis: [
        'ครัว บาร์ เซอร์วิส ได้ยินออเดอร์ใหม่แม้พับจอ — เซลล์กับ PR ถูกเรียกจากโต๊ะก็ดังได้ ไม่ต้องเปิดหน้า POS ค้าง',
        'เจ้าของกับผู้จัดการไม่มีกระดิ่งนี้ — ดูงานตอนอยู่ในระบบอยู่แล้ว',
        'เข้าสู่ระบบแล้วกดกระดิ่งมุมบน → กด เปิดแจ้งเตือนเครื่อง → กดอนุญาตเมื่อเครื่องถาม',
        'ไอโฟนต้องเปิดจากไอคอนหน้าจอโฮม (Safari) และ iOS 16.4 ขึ้นไป — เปิดแท็บ Safari อย่างเดียวเครื่องไม่ดัง',
        'Android เปิด Chrome หรือไอคอนหน้าจอหลัก แล้วอนุญาตการแจ้งเตือน',
        'ไม่กดเปิดแจ้งเตือนเครื่องก็ดูรายการในกระดิ่งได้ตอนเปิดแอปอยู่ แต่เครื่องจะไม่ดังถ้าพับจอ',
      ],
      phonePreview: {
        os: 'notify',
        browser: 'D-rink',
        caption: 'กดกระดิ่งมุมบน แล้วกดเปิดแจ้งเตือนเครื่อง',
        rows: [
          { pin: 1, label: 'กระดิ่ง', slot: 'menu' },
          { pin: 2, label: 'เปิดแจ้งเตือนเครื่อง', slot: 'sheet' },
        ],
      },
      warn: 'ไม่ดัง = ไอโฟนยังเปิดจากแท็บ Safari / ยังไม่กดอนุญาต / เปิดจากไลน์ / iOS ต่ำกว่า 16.4',
    },
  ],
};

export const SYSTEM_GUIDE_SETUP_WALKTHROUGH: GuideWalkthroughChapter[] = [
  HOMESCREEN_CHAPTER,
  {
    n: 2,
    title: 'ตั้งกฎร้าน',
    blurb: 'กติกาทั้งร้าน — รหัสเข้างานรอบแรก, ตัดกะ, on floor, เศษนาทีดื่ม',
    beats: [
      {
        title: 'เปิดเมนูกฎร้าน แล้วใส่ค่าตามร้าน',
        pathLabel: 'แถบซ้าย → การจัดการ → ตั้งค่าร้าน → กฎร้าน',
        route: '/dashboard/shop-rules',
        doThis: [
          'กดแถบซ้าย การจัดการ แล้วเปิด ตั้งค่าร้าน → กฎร้าน',
          'ใส่รหัสผ่านเริ่มต้นพนักงาน — คนใหม่ใช้รหัสนี้เข้าครั้งแรก',
          'ตั้งตัดกะอัตโนมัติ ถ้าลืมแสกนออก และตั้งเวลา on floor ของ PR แท็ก',
          'ตั้งเศษนาทีนั่งดื่ม 15 / 30 / 45 แล้วกด บันทึกกฎร้าน',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'ตั้งค่าร้าน', kind: 'group', active: true },
          { label: 'กฎร้าน', kind: 'child', active: true },
          { label: 'เครื่องพิมพ์ใบเสร็จ', kind: 'child' },
        ],
        screen: {
          pageTitle: 'กฎร้าน',
          fields: [
            { pin: 1, label: 'รหัสผ่านเริ่มต้น', sample: 'ใส่รหัสที่บอกพนักงานได้' },
            { pin: 2, label: 'ตัดกะอัตโนมัติ', sample: 'เช่น 12:00' },
            { pin: 3, label: 'เวลา on floor (PR แท็ก)', sample: 'เช่น 21:00' },
            { pin: 4, label: 'เศษนาทีดื่ม 15 / 30 / 45', sample: 'กี่ดื่มต่อช่วง' },
          ],
          primaryAction: 'บันทึกกฎร้าน',
        },
      },
    ],
  },
  {
    n: 3,
    title: 'ตั้งเครื่องดื่ม',
    blurb: 'ต้องทำตามลำดับนี้เท่านั้น: สต็อก → ประเภท → เครื่องดื่ม — สลับแล้วสั่งใน POS ไม่ได้',
    beats: [
      {
        title: 'ขั้น 3.1 สร้างสต็อกในคลังก่อน',
        pathLabel: 'แถบซ้าย → การจัดการ → คลังสินค้า → สต็อกเครื่องดื่ม',
        route: '/dashboard/stock',
        doThis: [
          'กด คลังสินค้า → สต็อกเครื่องดื่ม',
          'กดปุ่ม เพิ่มรายการสต็อก มุมขวาบน',
          'ใส่ชื่อ (เช่น โซดา, น้ำ, เอส) หน่วยนับ และจำนวนตั้งต้น',
          'กด บันทึก — ยังขายใน POS ไม่ได้ จนกว่าจะผูกกับเมนูเครื่องดื่ม',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'คลังสินค้า', kind: 'group', active: true },
          { label: 'สต็อกเครื่องดื่ม', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'คลังสินค้า',
          addButton: 'เพิ่มรายการสต็อก',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อสินค้า', sample: 'เช่น โซดา' },
            { pin: 3, label: 'หน่วยนับ', sample: 'ขวด / กระป๋อง' },
            { pin: 4, label: 'จำนวนที่เพิ่ม', sample: 'เช่น 24' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 3.2 สร้างประเภทเครื่องดื่ม',
        pathLabel: 'แถบซ้าย → การจัดการ → เครื่องดื่ม → ประเภทเครื่องดื่ม',
        route: '/dashboard/master-beverage-categories',
        doThis: [
          'กด เครื่องดื่ม → ประเภทเครื่องดื่ม',
          'กด เพิ่มประเภท',
          'ชื่อประเภท = ชื่อที่ร้านตั้งเอง เช่น เหล้า, เบียร์, มิกซ์เซอร์ — ใช้เป็นแท็บตอนเพิ่มเครื่องดื่ม',
          'กลุ่ม บอกระบบว่าเป็นเหล้า เบียร์ ไวน์ หรือมิกซ์เซอร์ — กลุ่มมิกซ์เซอร์เท่านั้นที่สั่งฟรีมิกซ์ได้ตอนเปิดโต๊ะ และโผล่แท็บฟรีมิกซ์ตอนลูกค้าสแกน QR',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'เครื่องดื่ม', kind: 'group', active: true },
          { label: 'เครื่องดื่ม', kind: 'child' },
          { label: 'ประเภทเครื่องดื่ม', kind: 'child', active: true },
          { label: 'ค็อกเทล', kind: 'child' },
        ],
        screen: {
          pageTitle: 'ประเภทเครื่องดื่ม',
          addButton: 'เพิ่มประเภท',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อประเภท', sample: 'ชื่อที่ร้านตั้ง เช่น มิกซ์เซอร์' },
            { pin: 3, label: 'กลุ่ม', sample: 'มิกซ์เซอร์ = สั่งฟรีได้ตอนเปิดโต๊ะ' },
          ],
          primaryAction: 'บันทึก',
        },
        warn: 'โซดา น้ำแข็ง น้ำอัดลม ต้องอยู่กลุ่มมิกซ์เซอร์ — ถ้าใส่กลุ่มเหล้า ระบบจะคิดว่าเป็นเหล้าขาย ลงฟรีมิกซ์ไม่ได้',
      },
      {
        title: 'ขั้น 3.3 เพิ่มเมนูเครื่องดื่ม (ถึงจะสั่งใน POS ได้)',
        pathLabel: 'แถบซ้าย → การจัดการ → เครื่องดื่ม → เครื่องดื่ม',
        route: '/dashboard/master-drinks',
        doThis: [
          'กด เครื่องดื่ม → เครื่องดื่ม',
          'เลือกแท็บประเภทด้านบน แล้วกด เพิ่มเครื่องดื่ม',
          'ใส่ชื่อ ราคา หน่วยนับ แล้วเลือกสินค้าสต็อกที่จะตัดตอนสั่ง',
          'กด บันทึก — รายการนี้จะโผล่ให้ลงบิลในหน้า POS',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'เครื่องดื่ม', kind: 'group', active: true },
          { label: 'เครื่องดื่ม', kind: 'child', active: true },
          { label: 'ประเภทเครื่องดื่ม', kind: 'child' },
          { label: 'ค็อกเทล', kind: 'child' },
        ],
        screen: {
          pageTitle: 'เครื่องดื่ม',
          addButton: 'เพิ่มเครื่องดื่ม',
          addButtonPin: 1,
          chips: ['เหล้า', 'เบียร์', 'มิกซ์เซอร์'],
          activeChip: 'เหล้า',
          fields: [
            { pin: 2, label: 'ชื่อเครื่องดื่ม', sample: 'เช่น โซดา' },
            { pin: 3, label: 'ราคา', sample: 'เช่น 80' },
            { pin: 4, label: 'สินค้าสต็อก', sample: 'เลือกของที่เพิ่งสร้าง' },
          ],
          primaryAction: 'บันทึก',
        },
        warn: 'ยังไม่มีสต็อกหรือประเภท จะเพิ่มเครื่องดื่มไม่ได้ — กลับไปขั้น 3.1 และ 3.2 ก่อน',
      },
      {
        title: 'ขั้น 3.4 ค็อกเทล (ร้านไหนขายค็อกเทลค่อยทำ)',
        pathLabel: 'แถบซ้าย → การจัดการ → เครื่องดื่ม → ค็อกเทล',
        route: '/dashboard/master-cocktails',
        doThis: [
          'กด เครื่องดื่ม → ค็อกเทล',
          'กด เพิ่มค็อกเทล ใส่ชื่อ จำนวนดื่ม หน่วยนับ',
          'กด บันทึก — จะโผล่ให้สั่งใน POS',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'เครื่องดื่ม', kind: 'group', active: true },
          { label: 'เครื่องดื่ม', kind: 'child' },
          { label: 'ประเภทเครื่องดื่ม', kind: 'child' },
          { label: 'ค็อกเทล', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ค็อกเทล',
          addButton: 'เพิ่มค็อกเทล',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อค็อกเทล', sample: 'เช่น โมฮิโต้' },
            { pin: 3, label: 'จำนวนดื่ม', sample: 'เช่น 1' },
          ],
          primaryAction: 'บันทึก',
        },
      },
    ],
  },
  {
    n: 4,
    title: 'ตั้งอาหาร',
    blurb: 'สร้างประเภทก่อน แล้วค่อยเพิ่มเมนู — สั่งแล้วครัวเห็นในเมนูออเดอร์',
    optional: true,
    beats: [
      {
        title: 'ขั้น 4.1 สร้างประเภทอาหาร',
        pathLabel: 'แถบซ้าย → การจัดการ → อาหาร → ประเภทอาหาร',
        route: '/dashboard/master-food-categories',
        doThis: [
          'กด อาหาร → ประเภทอาหาร',
          'กด เพิ่มประเภทอาหาร',
          'ใส่ชื่อ เช่น ทอด, ต้ม, ยำ หรือ อาหารพนักงาน แล้วกด บันทึก',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'อาหาร', kind: 'group', active: true },
          { label: 'อาหาร', kind: 'child' },
          { label: 'ประเภทอาหาร', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ประเภทอาหาร',
          addButton: 'เพิ่มประเภทอาหาร',
          addButtonPin: 1,
          fields: [{ pin: 2, label: 'ชื่อประเภท', sample: 'เช่น ทอด' }],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 4.2 เพิ่มเมนูอาหาร',
        pathLabel: 'แถบซ้าย → การจัดการ → อาหาร → อาหาร',
        route: '/dashboard/master-foods',
        doThis: [
          'กด อาหาร → อาหาร',
          'เลือกแท็บประเภท แล้วกด เพิ่มอาหาร',
          'ใส่ชื่อและราคา แล้วกด บันทึก',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'อาหาร', kind: 'group', active: true },
          { label: 'อาหาร', kind: 'child', active: true },
          { label: 'ประเภทอาหาร', kind: 'child' },
        ],
        screen: {
          pageTitle: 'อาหาร',
          addButton: 'เพิ่มอาหาร',
          addButtonPin: 1,
          chips: ['ทอด', 'ต้ม', 'ยำ'],
          activeChip: 'ทอด',
          fields: [
            { pin: 2, label: 'ชื่ออาหาร', sample: 'เช่น ปีกไก่ทอด' },
            { pin: 3, label: 'ราคา (บาท)', sample: 'เช่น 120' },
          ],
          primaryAction: 'บันทึก',
        },
      },
    ],
  },
  {
    n: 5,
    title: 'เบ็ดเตล็ด',
    blurb: 'ของนอกเมนูหลัก เช่น สแน็ค ผ้าเย็น — และค่าเปิดโต๊ะถ้ามี',
    optional: true,
    beats: [
      {
        title: 'เพิ่มของเบ็ดเตล็ด',
        pathLabel: 'แถบซ้าย → การจัดการ → เบ็ดเตล็ด → เบ็ดเตล็ด',
        route: '/dashboard/master-other-charges',
        doThis: [
          'กด เบ็ดเตล็ด → เบ็ดเตล็ด',
          'กด เพิ่มรายการ ใส่ชื่อ ราคา หน่วยนับ',
          'กด บันทึก — สั่งได้ใน POS',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'เบ็ดเตล็ด', kind: 'group', active: true },
          { label: 'เบ็ดเตล็ด', kind: 'child', active: true },
          { label: 'ค่าเปิดโต๊ะ', kind: 'child' },
        ],
        screen: {
          pageTitle: 'เบ็ดเตล็ด',
          addButton: 'เพิ่มรายการ',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อรายการ', sample: 'เช่น ผ้าเย็น' },
            { pin: 3, label: 'ราคา (บาท)', sample: 'เช่น 20' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ค่าเปิดโต๊ะ (ร้านไหนเก็บค่อยทำ)',
        pathLabel: 'แถบซ้าย → การจัดการ → เบ็ดเตล็ด → ค่าเปิดโต๊ะ',
        route: '/dashboard/master-table-opening-charges',
        doThis: [
          'กด เบ็ดเตล็ด → ค่าเปิดโต๊ะ',
          'กด เพิ่มรายการ ใส่ชื่อและราคา เช่น ผลไม้ ของว่าง',
          'กด บันทึก',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'เบ็ดเตล็ด', kind: 'group', active: true },
          { label: 'เบ็ดเตล็ด', kind: 'child' },
          { label: 'ค่าเปิดโต๊ะ', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ค่าเปิดโต๊ะ',
          addButton: 'เพิ่มรายการ',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อรายการ', sample: 'เช่น ผลไม้เปิดโต๊ะ' },
            { pin: 3, label: 'ราคา (บาท)', sample: 'เช่น 300' },
          ],
          primaryAction: 'บันทึก',
        },
      },
    ],
  },
  {
    n: 6,
    title: 'โปรโมชั่น',
    blurb: 'แพ็กเกจโปร ที่ลงบิลและฝาก–เบิกได้ — ต้องมีเครื่องดื่มในระบบก่อน',
    optional: true,
    beats: [
      {
        title: 'สร้างแพ็กเกจโปร',
        pathLabel: 'แถบซ้าย → การจัดการ → โปร/เมม → โปรโมชั่น',
        route: '/dashboard/master-promotions',
        doThis: [
          'กด โปร/เมม → โปรโมชั่น',
          'กด เพิ่มโปรโมชั่น ใส่ชื่อแพ็กเกจ',
          'กด + เพิ่มรายการ เพื่อใส่เครื่องดื่มในแพ็ก แล้วใส่ราคาแพ็กเกจ',
          'กด บันทึก — สวิตช์ด้านล่างฟอร์มอธิบายในขั้นถัดไป',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'โปร/เมม', kind: 'group', active: true },
          { label: 'โปรโมชั่น', kind: 'child', active: true },
          { label: 'เมมเบอร์', kind: 'child' },
        ],
        screen: {
          pageTitle: 'โปรโมชั่น',
          addButton: 'เพิ่มโปรโมชั่น',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อโปรโมชั่น', sample: 'เช่น โปร 2 ขวด' },
            { pin: 3, label: 'รายการในแพ็ก', sample: 'เลือกเครื่องดื่ม + จำนวน' },
            { pin: 4, label: 'ราคาแพ็กเกจ', sample: 'เช่น 2500' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'สวิตช์ของโปร — ฟรีมิกซ์ ฝากได้ สำหรับพนักงาน',
        pathLabel: 'แถบซ้าย → การจัดการ → โปร/เมม → โปรโมชั่น',
        route: '/dashboard/master-promotions',
        doThis: PACKAGE_TOGGLE_DO,
        nav: [
          ...NAV_PROMO_MEM,
          { label: 'โปรโมชั่น', kind: 'child', active: true },
          { label: 'เมมเบอร์', kind: 'child' },
        ],
        screen: {
          pageTitle: 'โปรโมชั่น',
          fields: PACKAGE_TOGGLE_FIELDS,
          primaryAction: 'บันทึก',
        },
        warn: 'ฟรีมิกซ์เซอร์ใช้ได้เฉพาะเครื่องดื่มที่อยู่กลุ่มมิกซ์เซอร์ — เหล้าในแพ็กไม่กลายเป็นฟรี',
      },
    ],
  },
  {
    n: 7,
    title: 'เมมเบอร์',
    blurb: 'แพ็กเกจเมม วิธีตั้งเหมือนโปร — ลงบิลและฝาก–เบิกได้',
    optional: true,
    beats: [
      {
        title: 'สร้างแพ็กเกจเมม',
        pathLabel: 'แถบซ้าย → การจัดการ → โปร/เมม → เมมเบอร์',
        route: '/dashboard/master-memberships',
        doThis: [
          'กด โปร/เมม → เมมเบอร์',
          'กด เพิ่มเมมเบอร์ ใส่ชื่อ',
          'ใส่เครื่องดื่มในแพ็ก และราคาแพ็กเกจ แล้วกด บันทึก',
          'สวิตช์ด้านล่างฟอร์มเหมือนโปร — อธิบายในขั้นถัดไป',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'โปร/เมม', kind: 'group', active: true },
          { label: 'โปรโมชั่น', kind: 'child' },
          { label: 'เมมเบอร์', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'เมมเบอร์',
          addButton: 'เพิ่มเมมเบอร์',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อเมมเบอร์', sample: 'เช่น เมมทอง' },
            { pin: 3, label: 'รายการในแพ็ก', sample: 'เลือกเครื่องดื่ม + จำนวน' },
            { pin: 4, label: 'ราคาแพ็กเกจ', sample: 'เช่น 5000' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'สวิตช์ของเมม — ฟรีมิกซ์ ฝากได้ สำหรับพนักงาน',
        pathLabel: 'แถบซ้าย → การจัดการ → โปร/เมม → เมมเบอร์',
        route: '/dashboard/master-memberships',
        doThis: PACKAGE_TOGGLE_DO,
        nav: [
          ...NAV_PROMO_MEM,
          { label: 'โปรโมชั่น', kind: 'child' },
          { label: 'เมมเบอร์', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'เมมเบอร์',
          fields: PACKAGE_TOGGLE_FIELDS,
          primaryAction: 'บันทึก',
        },
        warn: 'สวิตช์ทำงานเหมือนโปร — ฟรีมิกซ์เซอร์ใช้ได้เฉพาะกลุ่มมิกซ์เซอร์ ไม่ทำให้เหล้าในแพ็กฟรี',
      },
    ],
  },
  {
    n: 8,
    title: 'พนักงาน',
    blurb: 'สร้างตำแหน่งก่อน แล้วค่อยเพิ่มคน — ต้องมีเซลล์อย่างน้อย 1 คน ถึงจะเปิดโต๊ะใน POS ได้',
    beats: [
      {
        title: 'ขั้น 8.1 สร้างตำแหน่ง — ชื่อและสิทธิ์',
        pathLabel: 'แถบซ้าย → การจัดการ → จัดการพนักงาน → ตำแหน่ง',
        route: '/dashboard/master-roles',
        doThis: [
          'กด จัดการพนักงาน → ตำแหน่ง แล้วกด เพิ่มตำแหน่ง',
          'ชื่อตำแหน่ง (อังกฤษ) เป็นรหัสในระบบ เช่น SALE, PR — ไม่ใช้เป็นป้ายหลักบนจอ',
          'ชื่อแสดง (ไทย) คือชื่อที่พนักงานเห็น เช่น เซลล์, แคชเชียร์',
          'กลุ่มสิทธิ์ กำหนดว่าตำแหน่งนี้เห็นเมนูอะไร — เจ้าของครบสุด แล้วผู้จัดการ แคชเชียร์ พนักงาน (ดูตารางที่หน้าสิทธิ์)',
          'ประเภท เลือก พนักงาน หรือ เด็กนั่งดริ้ง — เด็กนั่งดริ้งคิดรันดื่ม/แท็ก คนละแบบกับกะเข้า–ออกของพนักงาน',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'จัดการพนักงาน', kind: 'group', active: true },
          { label: 'พนักงาน', kind: 'child' },
          { label: 'ตำแหน่ง', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ตำแหน่ง',
          addButton: 'เพิ่มตำแหน่ง',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อตำแหน่ง (อังกฤษ)', sample: 'รหัสระบบ เช่น SALE' },
            { pin: 3, label: 'ชื่อแสดง (ไทย)', sample: 'ที่คนเห็น เช่น เซลล์' },
            { pin: 4, label: 'กลุ่มสิทธิ์', sample: 'เห็นเมนูอะไร' },
            { pin: 5, label: 'ประเภท', sample: 'พนักงาน หรือ เด็กนั่งดริ้ง' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 8.2 ตั้งเวลากะและยอดดื่มของตำแหน่ง',
        pathLabel: 'แถบซ้าย → การจัดการ → จัดการพนักงาน → ตำแหน่ง',
        route: '/dashboard/master-roles',
        doThis: [
          'ถ้าประเภทเป็นพนักงาน: โควต้าลา = วันลาที่ไม่หักเงินต่อเดือน — เกินแล้วค่อยไปหักที่หน้าบันทึกเวลา',
          'เวลาเข้างาน / เวลาออกงาน ใช้เทียบตอนแสกนว่าสายหรือไม่ · เปิดออกงานวันถัดไปถ้าร้านปิดเช้ามืด',
          'ราคาต่อดื่ม = ยอดต่อ 1 ดื่มของตำแหน่งนี้ · หักดื่มเข้าร้าน = ส่วนที่ร้านเก็บ ที่เหลือจ่ายพนักงาน',
          'ถ้าประเภทเป็นเด็กนั่งดริ้ง: สตาร์ทดื่ม คิดตอนเริ่มนั่ง · รันดื่มต่อชม. นับทุกชั่วโมงเต็ม (เศษนาทีดูที่กฎร้าน)',
          'เด็กนั่งดริ้งไม่ใช้โควต้าลาและเวลาเข้า–ออกแบบพนักงาน — เวลา on floor ตั้งที่กฎร้าน',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'จัดการพนักงาน', kind: 'group', active: true },
          { label: 'พนักงาน', kind: 'child' },
          { label: 'ตำแหน่ง', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ตำแหน่ง',
          fields: [
            { pin: 1, label: 'โควต้าลา (พนักงาน)', sample: 'วัน/เดือน ที่ยังไม่หักเงิน' },
            { pin: 2, label: 'เวลาเข้า–ออกงาน', sample: 'เช่น 20:00 → 04:00' },
            { pin: 3, label: 'ราคาต่อดื่ม / หักร้าน', sample: 'ยอดดื่ม แล้วร้านเก็บเท่าไร' },
            { pin: 4, label: 'สตาร์ท + รันดื่มต่อชม.', sample: 'เด็กนั่งดริ้ง เช่น เริ่ม 2 / ชม.ละ 4' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 8.3 เพิ่มพนักงาน — ต้องมีเซลล์อย่างน้อย 1 คน',
        pathLabel: 'แถบซ้าย → การจัดการ → จัดการพนักงาน → พนักงาน',
        route: '/dashboard/employees',
        doThis: [
          'กด จัดการพนักงาน → พนักงาน เลือกแท็บตำแหน่งด้านบน แล้วกด เพิ่มพนักงาน',
          'รหัสพนักงาน = เลขที่คนพิมพ์ตอนเข้าสู่ระบบ ร้านตั้งเอง เช่น 1001 — ไม่ใช่รหัสผ่าน',
          'ใส่ชื่อเล่น แล้วเลือกหน้าที่ เซลล์ ถ้าคนนี้ต้องเปิดโต๊ะได้',
          'กดบันทึกได้เลย ไม่มีช่องรหัสผ่าน — ระบบใส่รหัสผ่านเริ่มต้นจากกฎร้านให้ คนเข้าครั้งแรกต้องเปลี่ยนเอง',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'จัดการพนักงาน', kind: 'group', active: true },
          { label: 'พนักงาน', kind: 'child', active: true },
          { label: 'ตำแหน่ง', kind: 'child' },
        ],
        screen: {
          pageTitle: 'จัดการพนักงาน',
          addButton: 'เพิ่มพนักงาน',
          addButtonPin: 1,
          chips: ['ผู้จัดการ', 'แคชเชียร์', 'เซลล์'],
          activeChip: 'เซลล์',
          fields: [
            { pin: 2, label: 'รหัสพนักงาน', sample: 'เลขล็อกอิน เช่น 1001 — ไม่ใช่รหัสผ่าน' },
            { pin: 3, label: 'ชื่อเล่น', sample: 'เช่น เฟิร์น' },
            { pin: 4, label: 'หน้าที่ทำงาน', sample: 'เลือก เซลล์ ถ้าเปิดโต๊ะ' },
          ],
          primaryAction: 'บันทึก',
        },
        warn: 'รหัสผ่านไม่ต้องพิมพ์ตอนเพิ่มคน — ตั้งที่กฎร้าน · ไม่มีหน้าที่เซลล์แล้วเปิดโต๊ะใน POS ไม่ได้',
      },
    ],
  },
  {
    n: 9,
    title: 'โต๊ะ',
    blurb: 'สร้างประเภทโซนก่อน แล้วค่อยเพิ่มโต๊ะ — ไม่มีโต๊ะเปิด POS ไม่ได้',
    beats: [
      {
        title: 'ขั้น 9.1 สร้างประเภทโซนที่นั่ง',
        pathLabel: 'แถบซ้าย → การจัดการ → จัดการที่นั่ง → ประเภทโซนที่นั่ง',
        route: '/dashboard/master-seating-types',
        doThis: [
          'กด จัดการที่นั่ง → ประเภทโซนที่นั่ง',
          'กด เพิ่มประเภท ใส่ชื่อ เช่น โถง, VIP, ห้อง',
          'กด บันทึก — ต้องมีประเภทก่อนถึงจะสร้างโต๊ะได้',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'จัดการที่นั่ง', kind: 'group', active: true },
          { label: 'โซนที่นั่ง', kind: 'child' },
          { label: 'ประเภทโซนที่นั่ง', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'ประเภทที่นั่ง',
          addButton: 'เพิ่มประเภท',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อประเภท', sample: 'เช่น โถง' },
            { pin: 3, label: 'รหัส', sample: 'เช่น HALL' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 9.2 สร้างโต๊ะ',
        pathLabel: 'แถบซ้าย → การจัดการ → จัดการที่นั่ง → โซนที่นั่ง',
        route: '/dashboard/master-seatings',
        doThis: [
          'กด จัดการที่นั่ง → โซนที่นั่ง',
          'เลือกแท็บประเภท แล้วกด เพิ่มที่นั่ง',
          'ใส่รหัสโต๊ะ เช่น A1 — ถ้าคิดค่าห้อง ให้เปิดคิดค่าบริการ',
          'กด บันทึก — จัดผังโต๊ะไม่บังคับ ไม่จัดก็เปิดจากรายการได้',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'จัดการที่นั่ง', kind: 'group', active: true },
          { label: 'โซนที่นั่ง', kind: 'child', active: true },
          { label: 'ประเภทโซนที่นั่ง', kind: 'child' },
          { label: 'จัดผังโต๊ะ', kind: 'child' },
        ],
        screen: {
          pageTitle: 'โซนที่นั่ง',
          addButton: 'เพิ่มที่นั่ง',
          addButtonPin: 1,
          chips: ['โถง', 'VIP'],
          activeChip: 'โถง',
          fields: [
            { pin: 2, label: 'รหัสที่นั่ง', sample: 'เช่น A1' },
            { pin: 3, label: 'คิดค่าบริการ', sample: 'เปิดถ้าเป็นห้องคิดรายชั่วโมง' },
          ],
          primaryAction: 'บันทึก',
        },
        warn: 'ยังไม่มีประเภทโซน — กลับไปขั้น 9.1 ก่อน เพิ่มโต๊ะไม่ได้',
      },
    ],
  },
  {
    n: 10,
    title: 'แท็ก PR',
    blurb: 'สร้างแพ็กเกจก่อน แล้วค่อยลงแท็กให้เด็กนั่งดริ้งที่เมนูจัดการ tag',
    optional: true,
    beats: [
      {
        title: 'ขั้น 10.1 สร้างแพ็กเกจแท็ก',
        pathLabel: 'แถบซ้าย → การจัดการ → แพ็กเกจแท็ก → แพ็กเกจแท็ก PR',
        route: '/dashboard/master-pr-tags',
        doThis: [
          'กด แพ็กเกจแท็ก → แพ็กเกจแท็ก PR',
          'กด เพิ่มแพ็กเกจ ใส่ชื่อ จำนวนวันทำงาน วันหยุด',
          'ตั้งจำนวนยอดดื่มที่ต้องทำ และเงินการันตี แล้วกด บันทึก',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'แพ็กเกจแท็ก', kind: 'group', active: true },
          { label: 'แพ็กเกจแท็ก PR', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'แท็ก PR',
          addButton: 'เพิ่มแพ็กเกจ',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'ชื่อแท็ก', sample: 'เช่น แท็ก 10 วัน' },
            { pin: 3, label: 'วันทำงาน / วันหยุด', sample: 'เช่น 10 / 2' },
            { pin: 4, label: 'ยอดดื่มที่ต้องทำ', sample: 'เช่น 40' },
          ],
          primaryAction: 'บันทึก',
        },
      },
      {
        title: 'ขั้น 10.2 ลงแท็กให้คน (เมนูจัดการ tag)',
        pathLabel: 'แถบซ้าย → จัดการ tag',
        route: '/dashboard/pr-tag-operations',
        doThis: [
          'กดเมนู จัดการ tag ในแถบซ้าย (ไม่ได้อยู่ในกลุ่มการจัดการ)',
          'กด ลงแท็ก เลือกเด็กนั่งดริ้งและแพ็กเกจ',
          'แก้แพ็กเกจหรือตัดแท็กได้จากรายชื่อคนที่ติดแท็กอยู่',
        ],
        nav: [
          { label: 'POS', kind: 'link' },
          { label: 'จัดการ tag', kind: 'link', active: true },
          { label: 'จ่ายค่าดื่ม PR', kind: 'link' },
        ],
        screen: {
          pageTitle: 'จัดการ tag',
          addButton: 'ลงแท็ก',
          addButtonPin: 1,
          fields: [
            { pin: 2, label: 'เลือกคน', sample: 'เด็กนั่งดริ้ง' },
            { pin: 3, label: 'แพ็กเกจ', sample: 'แท็ก 10 วัน' },
          ],
          primaryAction: 'ยืนยันลงแท็ก',
        },
        warn: 'ยังไม่มีแพ็กเกจแท็ก — กลับไปขั้น 10.1 ก่อน ลงแท็กไม่ได้',
      },
    ],
  },
  {
    n: 11,
    title: 'เครื่องพิมพ์ใบเสร็จ',
    blurb:
      'D-rink เป็นเว็บ ไม่ใช่แอพมือถือ — พิมพ์จากมือถือต้องโหลดแอพช่วยส่งงานไปเครื่องปริ้น เช็กบิลได้แม้ยังไม่ตั้งพิมพ์',
    optional: true,
    beats: [
      {
        title: 'ขั้น 11.1 Android — โหลดแอพ RawBT',
        doThis: [
          'เปิด Play Store บนมือถือหรือแท็บเล็ต Android',
          'ค้นหา RawBT — เลือกแอพที่ไอคอนเป็นเครื่องปริ้นสีน้ำเงินเข้ม มีกระดาษเขียน RAWBT (ตามรูปด้านข้าง)',
          'กดติดตั้ง แล้วเปิดแอพ RawBT',
          'ใน RawBT เลือกเครื่องปริ้นบลูทูธที่จับคู่แล้ว เช่น POS-58',
          'พิมพ์ทดสอบใน RawBT ให้กระดาษออกก่อน แล้วค่อยกลับมาตั้งใน D-rink',
        ],
        image: {
          src: '/guide/rawbt-icon.png',
          alt: 'ไอคอนแอพ RawBT เป็นเครื่องปริ้นสีน้ำเงิน มีคำว่า RAWBT บนใบเสร็จ',
          caption: 'ไอคอน RawBT ใน Play Store — เครื่องปริ้นสีน้ำเงิน มีคำว่า RAWBT บนใบเสร็จ',
        },
        storeLink: {
          href: 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter',
          label: 'เปิด Play Store — RawBT',
        },
        warn: 'D-rink เปิดใน Chrome/เบราว์เซอร์ พิมพ์บลูทูธตรงไม่ได้ ต้องให้ RawBT เป็นตัวส่งงานไปเครื่องปริ้น',
      },
      {
        title: 'ขั้น 11.2 iPhone — โหลดแอพ AHAS Print Service',
        doThis: [
          'เปิด App Store บนไอโฟนหรือไอแพด ค้นหา AHAS Print Service (ฟรี)',
          'เลือกแอพไอคอนเครื่องปริ้นพื้นเขียว ตามรูปด้านข้าง แล้วกดรับ/ติดตั้ง',
          'เปิดแอพ AHAS Print Service แล้วจับคู่เครื่องปริ้นบลูทูธ เช่น POS-58',
          'พิมพ์ทดสอบในแอพให้กระดาษออกก่อน แล้วเปิดแอพค้างไว้ตอนใช้ POS',
        ],
        image: {
          src: '/guide/ahas-print-service-icon.png',
          alt: 'ไอคอนแอพ AHAS Print Service เป็นเครื่องปริ้นสีขาวบนพื้นเขียว',
          caption: 'ไอคอน AHAS Print Service ใน App Store — ฟรี',
        },
        storeLink: {
          href: 'https://apps.apple.com/th/app/ahas-print-service/id6758015388',
          label: 'เปิด App Store — AHAS Print Service',
        },
        warn: 'ไอโฟนพิมพ์บลูทูธจากเว็บตรงไม่ได้ — ข้อจำกัดของ iOS ไม่ใช่ข้อจำกัดของร้าน ต้องเปิดแอพช่วยค้างไว้ ใช้ได้ตั้งแต่ iOS 12',
      },
      {
        title: 'ขั้น 11.3 ตั้งโหมดพิมพ์ใน D-rink',
        pathLabel: 'แถบซ้าย → การจัดการ → ตั้งค่าร้าน → เครื่องพิมพ์ใบเสร็จ',
        route: '/dashboard/receipt-printer',
        doThis: [
          'กด ตั้งค่าร้าน → เครื่องพิมพ์ใบเสร็จ',
          'โหมดพิมพ์ เลือก อัตโนมัติ หรือ แอปตัวกลาง (Android ใช้ RawBT / ไอโฟนใช้ AHAS Print Service)',
          'ความกว้างกระดาษเลือก 58 มม. ถ้าเป็นเครื่อง POS58',
          'ใส่ข้อความหัว–ท้ายใบเสร็จได้ถ้าต้องการ แล้วกด บันทึกการตั้งค่า',
          'ตอนเช็กบิลกดไอคอนเครื่องพิมพ์ข้างหัวข้อ เช็กบิล — พิมพ์ซ้ำได้จากไอคอนหลังเลขบิลในประวัติบิล หรือโต๊ะที่รอลูกค้ากลับ',
        ],
        nav: [
          ...NAV_MGMT_HEAD,
          { label: 'ตั้งค่าร้าน', kind: 'group', active: true },
          { label: 'กฎร้าน', kind: 'child' },
          { label: 'เครื่องพิมพ์ใบเสร็จ', kind: 'child', active: true },
        ],
        screen: {
          pageTitle: 'เครื่องพิมพ์ใบเสร็จ',
          fields: [
            { pin: 1, label: 'โหมดพิมพ์', sample: 'อัตโนมัติ หรือ แอปตัวกลาง' },
            { pin: 2, label: 'ความกว้างกระดาษ', sample: '58 mm (POS58)' },
            { pin: 3, label: 'หัว / ท้ายใบเสร็จ', sample: 'ใส่ได้ ไม่บังคับ' },
          ],
          primaryAction: 'บันทึกการตั้งค่า',
        },
      },
      {
        title: 'ขั้น 11.4 คอมพิวเตอร์',
        doThis: [
          'คอมพิวเตอร์ (Windows) — ไม่ต้องโหลดแอพ เลือกโหมด อัตโนมัติ หรือ เบราว์เซอร์ แล้วติดตั้งไดรเวอร์ USB ของเครื่องปริ้น',
          'พิมพ์จากหน้าต่าง Print ของเบราว์เซอร์ เลือกเครื่อง POS-58',
        ],
        warn: 'ไม่ตั้งเครื่องพิมพ์ก็เช็กบิลได้ — แค่พิมพ์ใบเสร็จไม่ได้จนกว่าจะตั้งครบ',
      },
    ],
  },
  {
    n: 12,
    title: 'ลองในหน้า POS',
    blurb: 'ตั้งครบแล้ว ลองเปิดโต๊ะ ลงของ เช็กบิล หนึ่งรอบก่อนเปิดร้านจริง',
    beats: [
      {
        title: 'เปิดโต๊ะ ลงเครื่องดื่ม แล้วเช็กบิล',
        pathLabel: 'แถบซ้าย → POS',
        route: '/dashboard/open-table',
        doThis: [
          'กดเมนู POS',
          'กดโต๊ะว่าง → เลือกเซลล์ → กดเปิดโต๊ะ',
          'เลือกหมวดเครื่องดื่ม เลือกรายการ กดเพิ่ม',
          'กดเช็กบิล เมื่อทดลองเสร็จ — แล้วกดลูกค้ากลับแล้ว เพื่อคืนโต๊ะว่าง',
        ],
        nav: [
          { label: 'ภาพรวม', kind: 'link' },
          { label: 'POS', kind: 'link', active: true },
          { label: 'ออเดอร์', kind: 'link' },
          { label: 'การจัดการ', kind: 'section' },
        ],
        screen: {
          pageTitle: 'POS',
          chips: ['ว่าง', 'ใช้งาน'],
          activeChip: 'ว่าง',
          fields: [
            { pin: 1, label: 'โต๊ะว่าง', sample: 'กด A1 เพื่อเปิด' },
            { pin: 2, label: 'เลือกเซลล์', sample: 'คนที่เพิ่งเพิ่ม' },
            { pin: 3, label: 'ลงเครื่องดื่ม', sample: 'เลือกหมวด → เพิ่ม' },
            { pin: 4, label: 'เช็กบิล', sample: 'ปิดบิลทดสอบ' },
          ],
          primaryAction: 'เปิดโต๊ะ',
        },
        warn: 'เปิดโต๊ะไม่ได้ = ยังไม่มีเซลล์ (ขั้นที่ 8) หรือยังไม่มีโต๊ะ (ขั้นที่ 9) · สั่งของไม่ได้ = ยังไม่ได้ตั้งเครื่องดื่มให้ครบขั้นที่ 3',
      },
    ],
  },
];
