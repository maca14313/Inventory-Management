/**
 * Internationalization (i18n) System
 * Supports: English (en), Amharic (am), Afaan Oromo (om), Arabic (ar), French (fr)
 */

export type Locale = 'en' | 'am' | 'om' | 'ar' | 'fr'

export const locales: { code: Locale; name: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'am', name: 'አማርኛ', dir: 'ltr' },
  { code: 'om', name: 'Afaan Oromoo', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
]

type TranslationKeys = {
  // App
  appName: string
  appSubtitle: string
  // Nav
  navDashboard: string
  navProducts: string
  navStock: string
  navOrders: string
  navWarehouses: string
  navSuppliers: string
  navCategories: string
  navEnterprises: string
  navBranches: string
  navUsers: string
  navRoles: string
  // Dashboard
  kpiProducts: string
  kpiStockValue: string
  kpiPendingOrders: string
  kpiLowStock: string
  kpiCategories: string
  kpiWarehouses: string
  kpiSuppliers: string
  kpiEnterprises: string
  kpiBranches: string
  lowStockAlerts: string
  stockByWarehouse: string
  orderStatus: string
  current: string
  reorderLevel: string
  deficit: string
  utilization: string
  // Tables
  colSku: string
  colName: string
  colCategory: string
  colPrice: string
  colCost: string
  colReorder: string
  colStatus: string
  colActions: string
  colProduct: string
  colWarehouse: string
  colQuantity: string
  colValue: string
  colType: string
  colSupplier: string
  colAmount: string
  colNotes: string
  colLocation: string
  colCapacity: string
  colContact: string
  colEmail: string
  colPhone: string
  colRole: string
  colEnterprise: string
  colBranch: string
  colActive: string
  colId: string
  // Actions
  add: string
  edit: string
  delete: string
  save: string
  cancel: string
  search: string
  close: string
  adjustStock: string
  newOrder: string
  apply: string
  // Modals
  newProduct: string
  editProduct: string
  newCategory: string
  editCategory: string
  newWarehouse: string
  editWarehouse: string
  newSupplier: string
  editSupplier: string
  newOrder_title: string
  editOrder: string
  newEnterprise: string
  editEnterprise: string
  newBranch: string
  editBranch: string
  newUser: string
  editUser: string
  // Labels
  labelName: string
  labelDescription: string
  labelSku: string
  labelUnit: string
  labelCompanyName: string
  labelContactPerson: string
  labelAddress: string
  labelOrderType: string
  labelPurchaseOrder: string
  labelSalesOrder: string
  labelNone: string
  // Status
  statusActive: string
  statusInactive: string
  statusOk: string
  statusLow: string
  // Auth
  login: string
  logout: string
  loginTitle: string
  loginSubtitle: string
  labelEmail: string
  labelPassword: string
  loginButton: string
  switchRole: string
  currentRole: string
  // Roles
  roleSuperAdmin: string
  roleEnterpriseAdmin: string
  roleBranchAdmin: string
  roleWarehouseAdmin: string
  roleUser: string
  // Permissions
  permLabel: string
  permProducts: string
  permOrders: string
  permStock: string
  permUsers: string
  permEnterprises: string
  permBranches: string
  permWarehouses: string
  permCategories: string
  permSuppliers: string
  // Enterprise
  enterpriseAbilities: string
  enterpriseSettings: string
  // General
  loading: string
  noData: string
  created: string
  updated: string
  deleted: string
  confirmDelete: string
}

const translations: Record<Locale, TranslationKeys> = {
  en: {
    appName: 'Inventory Management', appSubtitle: 'Enterprise IMS',
    navDashboard: 'Dashboard', navProducts: 'Products', navStock: 'Stock', navOrders: 'Orders',
    navWarehouses: 'Warehouses', navSuppliers: 'Suppliers', navCategories: 'Categories',
    navEnterprises: 'Enterprises', navBranches: 'Branches', navUsers: 'Users', navRoles: 'Roles',
    kpiProducts: 'Products', kpiStockValue: 'Stock Value', kpiPendingOrders: 'Pending Orders',
    kpiLowStock: 'Low Stock', kpiCategories: 'Categories', kpiWarehouses: 'Warehouses',
    kpiSuppliers: 'Suppliers', kpiEnterprises: 'Enterprises', kpiBranches: 'Branches',
    lowStockAlerts: 'Low Stock Alerts', stockByWarehouse: 'Stock by Warehouse', orderStatus: 'Order Status',
    current: 'Current', reorderLevel: 'Reorder Level', deficit: 'Deficit', utilization: 'Utilization',
    colSku: 'SKU', colName: 'Name', colCategory: 'Category', colPrice: 'Price', colCost: 'Cost',
    colReorder: 'Reorder', colStatus: 'Status', colActions: 'Actions', colProduct: 'Product',
    colWarehouse: 'Warehouse', colQuantity: 'Quantity', colValue: 'Value', colType: 'Type',
    colSupplier: 'Supplier', colAmount: 'Amount', colNotes: 'Notes', colLocation: 'Location',
    colCapacity: 'Capacity', colContact: 'Contact', colEmail: 'Email', colPhone: 'Phone',
    colRole: 'Role', colEnterprise: 'Enterprise', colBranch: 'Branch', colActive: 'Active', colId: 'ID',
    add: 'Add', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel', search: 'Search',
    close: 'Close', adjustStock: 'Adjust Stock', newOrder: 'New Order', apply: 'Apply',
    newProduct: 'New Product', editProduct: 'Edit Product', newCategory: 'New Category',
    editCategory: 'Edit Category', newWarehouse: 'New Warehouse', editWarehouse: 'Edit Warehouse',
    newSupplier: 'New Supplier', editSupplier: 'Edit Supplier', newOrder_title: 'New Order',
    editOrder: 'Edit Order', newEnterprise: 'New Enterprise', editEnterprise: 'Edit Enterprise',
    newBranch: 'New Branch', editBranch: 'Edit Branch', newUser: 'New User', editUser: 'Edit User',
    labelName: 'Name', labelDescription: 'Description', labelSku: 'SKU', labelUnit: 'Unit',
    labelCompanyName: 'Company Name', labelContactPerson: 'Contact Person', labelAddress: 'Address',
    labelOrderType: 'Order Type', labelPurchaseOrder: 'Purchase Order', labelSalesOrder: 'Sales Order',
    labelNone: 'None',
    statusActive: 'Active', statusInactive: 'Inactive', statusOk: 'OK', statusLow: 'Low',
    login: 'Login', logout: 'Logout', loginTitle: 'Sign In', loginSubtitle: 'Inventory Management System',
    labelEmail: 'Email', labelPassword: 'Password', loginButton: 'Sign In', switchRole: 'Switch Role',
    currentRole: 'Current Role',
    roleSuperAdmin: 'Super Admin', roleEnterpriseAdmin: 'Enterprise Admin',
    roleBranchAdmin: 'Branch Admin', roleWarehouseAdmin: 'Warehouse Admin', roleUser: 'User',
    permLabel: 'Permissions', permProducts: 'Products', permOrders: 'Orders', permStock: 'Stock',
    permUsers: 'Users', permEnterprises: 'Enterprises', permBranches: 'Branches',
    permWarehouses: 'Warehouses', permCategories: 'Categories', permSuppliers: 'Suppliers',
    enterpriseAbilities: 'Enterprise Abilities', enterpriseSettings: 'Settings',
    loading: 'Loading inventory data...', noData: 'No data', created: 'Created!',
    updated: 'Updated!', deleted: 'Deleted', confirmDelete: 'Are you sure?',
  },
  am: {
    appName: 'ዕቃ አስተዳደር', appSubtitle: 'የስራ ቦታ IMS',
    navDashboard: 'ዳሽቦርድ', navProducts: 'ምርቶች', navStock: 'ክምችት', navOrders: 'ትዕዛዞች',
    navWarehouses: 'ማከያዎች', navSuppliers: 'አቅራቢዎች', navCategories: 'ምድቦች',
    navEnterprises: 'ድርጆች', navBranches: 'ቅርንጫቶች', navUsers: 'ተጠቃሚዎች', navRoles: 'ሚናዎች',
    kpiProducts: 'ምርቶች', kpiStockValue: 'የክምችት ዋጋ', kpiPendingOrders: 'ቆይታ ላይ ያሉ',
    kpiLowStock: 'ዝቅተኛ ክምችት', kpiCategories: 'ምድቦች', kpiWarehouses: 'ማከያዎች',
    kpiSuppliers: 'አቅራቢዎች', kpiEnterprises: 'ድርጆች', kpiBranches: 'ቅርንጫቶች',
    lowStockAlerts: 'ዝቅተኛ ክምችት ማስጠንቀቅ', stockByWarehouse: 'በማከያ ክምችት', orderStatus: 'የትዕዛዝ ሁኔታ',
    current: 'የአሁን', reorderLevel: 'ዳግማ የትዕዛዝ ደረጃ', deficit: 'እጥር', utilization: 'አጠቃላይ አገልግሎት',
    colSku: 'SKU', colName: 'ስም', colCategory: 'ምድብ', colPrice: 'ዋጋ', colCost: 'ወጪ',
    colReorder: 'ዳግማ ደረጃ', colStatus: 'ሁኔታ', colActions: 'ተግባር', colProduct: 'ምርት',
    colWarehouse: 'ማከያ', colQuantity: 'ብዛት', colValue: 'ዋጋ', colType: 'ዓይነት',
    colSupplier: 'አቅራቢ', colAmount: 'መጠን', colNotes: 'ማስታወሻ', colLocation: 'ቦታ',
    colCapacity: 'አቅም', colContact: 'እውቂያ', colEmail: 'ኢሜል', colPhone: 'ስልክ',
    colRole: 'ሚና', colEnterprise: 'ድርጅት', colBranch: 'ቅርንጫት', colActive: 'ንቁ', colId: 'ቁጥር',
    add: 'ጨምር', edit: 'አስተካክል', delete: 'ሰርዝ', save: 'አስቀምጥ', cancel: 'ሰርዝ', search: 'ፈልግ',
    close: 'ዝጊ', adjustStock: 'ክምችት አስተካክል', newOrder: 'አዲስ ትዕዛዝ', apply: 'ተግባር',
    newProduct: 'አዲስ ምርት', editProduct: 'ምርት አስተካክል', newCategory: 'አዲስ ምድብ',
    editCategory: 'ምድብ አስተካክል', newWarehouse: 'አዲስ ማከያ', editWarehouse: 'ማከያ አስተካክል',
    newSupplier: 'አዲስ አቅራቢ', editSupplier: 'አቅራቢ አስተካክል', newOrder_title: 'አዲስ ትዕዛዝ',
    editOrder: 'ትዕዛዝ አስተካክል', newEnterprise: 'አዲስ ድርጅት', editEnterprise: 'ድርጅት አስተካክል',
    newBranch: 'አዲስ ቅርንጫት', editBranch: 'ቅርንጫት አስተካክል', newUser: 'አዲስ ተጠቃሚ', editUser: 'ተጠቃሚ አስተካክል',
    labelName: 'ስም', labelDescription: 'መግለጫ', labelSku: 'SKU', labelUnit: 'መለኪያ',
    labelCompanyName: 'የኩባንያ ስም', labelContactPerson: 'የእውቂያ ሰው', labelAddress: 'አድራሻ',
    labelOrderType: 'የትዕዛዝ ዓይነት', labelPurchaseOrder: 'የግዢ ትዕዛዝ', labelSalesOrder: 'የሽያይ ትዕዛዝ',
    labelNone: 'ምንም',
    statusActive: 'ንቁ', statusInactive: 'ንቁ ያልሆነ', statusOk: 'እሺ', statusLow: 'ዝቅተኛ',
    login: 'ግባ', logout: 'ውጣ', loginTitle: 'ግባ', loginSubtitle: 'የዕቃ አስተዳደር ስርዓት',
    labelEmail: 'ኢሜል', labelPassword: 'የይለፍ ቃል', loginButton: 'ግባ', switchRole: 'ሚና ቀይር',
    currentRole: 'የአሁን ሚና',
    roleSuperAdmin: 'ዋና አስተዳዳሪ', roleEnterpriseAdmin: 'የድርጅት አስተዳዳሪ',
    roleBranchAdmin: 'የቅርንጫት አስተዳዳሪ', roleWarehouseAdmin: 'የማከያ አስተዳዳሪ', roleUser: 'ተጠቃሚ',
    permLabel: 'ፍቃዶች', permProducts: 'ምርቶች', permOrders: 'ትዕዛዞች', permStock: 'ክምችት',
    permUsers: 'ተጠቃሚዎች', permEnterprises: 'ድርጆች', permBranches: 'ቅርንጫቶች',
    permWarehouses: 'ማከያዎች', permCategories: 'ምድቦች', permSuppliers: 'አቅራቢዎች',
    enterpriseAbilities: 'የድርጅት ችሎታዎች', enterpriseSettings: 'ቅንብሮ',
    loading: 'ውሂብ በመጫን ላይ...', noData: 'ውሂብ የለም', created: 'ተፈጠረ!',
    updated: 'የተሻሻተ!', deleted: 'ተሰረዘ', confirmDelete: 'እርገመኛል?',
  },
  om: {
    appName: 'Bulleessa Qabeenya', appSubtitle: 'IMS Dhaabbataa',
    navDashboard: 'Balballaa', navProducts: 'Oomishaalee', navStock: 'Qabeenya', navOrders: 'Ajajilee',
    navWarehouses: 'Mana qabeenya', navSuppliers: 'Kennitoota', navCategories: 'Gurmiilee',
    navEnterprises: 'Dhaabbileewwan', navBranches: 'Daangaalee', navUsers: 'Fayyadamtoota', navRoles: 'Gahee',
    kpiProducts: 'Oomishaalee', kpiStockValue: 'Gatii qabeenya', kpiPendingOrders: 'Ajajilee eegaa',
    kpiLowStock: 'Qabeenya xiqqaa', kpiCategories: 'Gurmiilee', kpiWarehouses: 'Mana qabeenya',
    kpiSuppliers: 'Kennitoota', kpiEnterprises: 'Dhaabbileewwan', kpiBranches: 'Daangaalee',
    lowStockAlerts: 'Akeekkachiisa qabeenya xiqqaa', stockByWarehouse: 'Qabeenya mana qabeenyaatiin', orderStatus: 'Haala ajajaa',
    current: 'Ammaa', reorderLevel: 'Safxa ajajii', deficit: 'Hapha', utilization: 'Fayyadamuu',
    colSku: 'SKU', colName: 'Maqaa', colCategory: 'Gurmii', colPrice: 'Gatii', colCost: 'Baasi',
    colReorder: 'Ajajii deebisuu', colStatus: 'Haala', colActions: 'Hojii', colProduct: 'Oomishaa',
    colWarehouse: 'Mana qabeenya', colQuantity: 'Lakkoofsa', colValue: 'Gatii', colType: 'Akaajja',
    colSupplier: 'Kennituu', colAmount: "Baay'ina", colNotes: 'Yaadanno', colLocation: 'Bakka',
    colCapacity: 'Humna', colContact: 'Quunnamtii', colEmail: 'Imeel', colPhone: 'Bilbila',
    colRole: 'Gahee', colEnterprise: 'Dhaabbata', colBranch: 'Daangaa', colActive: "Socho'ii", colId: 'Lak.',
    add: 'Dabali', edit: 'Gulaali', delete: 'Haqi', save: "Olkaa'i", cancel: 'Dhiisi', search: 'Barbaadi',
    close: 'Cufi', adjustStock: 'Qabeenya gulaali', newOrder: 'Ajaja haaraa', apply: 'Hojiirra ooli',
    newProduct: 'Oomishaa haaraa', editProduct: 'Oomishaa gulaali', newCategory: 'Gurmii haaraa',
    editCategory: 'Gurmii gulaali', newWarehouse: 'Mana qabeenya haaraa', editWarehouse: 'Mana qabeenya gulaali',
    newSupplier: 'Kennituu haaraa', editSupplier: 'Kennituu gulaali', newOrder_title: 'Ajaja haaraa',
    editOrder: 'Ajajaa gulaali', newEnterprise: 'Dhaabbata haaraa', editEnterprise: 'Dhaabbata gulaali',
    newBranch: 'Daangaa haaraa', editBranch: 'Daangaa gulaali', newUser: 'Fayyadamaa haaraa', editUser: 'Fayyadamaa gulaali',
    labelName: 'Maqaa', labelDescription: 'Ibsa', labelSku: 'SKU', labelUnit: 'Safartuu',
    labelCompanyName: 'Maqaa dhaabbataa', labelContactPerson: 'Nama quunnamtii', labelAddress: 'Teessoo',
    labelOrderType: 'Akaajja ajajaa', labelPurchaseOrder: 'Ajaja bitaa', labelSalesOrder: 'Ajaja gurguraa',
    labelNone: 'Tokkollee',
    statusActive: "Socho'ii", statusInactive: 'Hin sochoone', statusOk: 'Tol', statusLow: 'Gadii',
    login: 'Seeni', logout: "Ba'i", loginTitle: 'Seeni', loginSubtitle: 'Sirna bulleessa qabeenya',
    labelEmail: 'Imeel', labelPassword: 'Jecha icciitii', loginButton: 'Seeni', switchRole: 'Gahee jijjiiri',
    currentRole: 'Gahee ammaa',
    roleSuperAdmin: 'Bulcha guddaa', roleEnterpriseAdmin: 'Bulcha dhaabbataa',
    roleBranchAdmin: 'Bulcha daangaa', roleWarehouseAdmin: 'Bulcha mana qabeenya', roleUser: 'Fayyadamaa',
    permLabel: 'Seensa', permProducts: 'Oomishaalee', permOrders: 'Ajajilee', permStock: 'Qabeenya',
    permUsers: 'Fayyadamtoota', permEnterprises: 'Dhaabbileewwan', permBranches: 'Daangaalee',
    permWarehouses: 'Mana qabeenya', permCategories: 'Gurmiilee', permSuppliers: 'Kennitoota',
    enterpriseAbilities: 'Dandeettii dhaabbataa', enterpriseSettings: "Qindaa'ina",
    loading: "Deetaa fe'aa jira...", noData: 'Deetaa hin jiru', created: 'Uumame!',
    updated: 'Haaromfame!', deleted: 'Haqame', confirmDelete: 'Sirritti yaaddoo?',
  },
  ar: {
    appName: 'إدارة المخزون', appSubtitle: 'نظام IMS للمؤسسات',
    navDashboard: 'لوحة التحكم', navProducts: 'المنتجات', navStock: 'المخزون', navOrders: 'الطلبات',
    navWarehouses: 'المستودعات', navSuppliers: 'الموردون', navCategories: 'الفئات',
    navEnterprises: 'المؤسسات', navBranches: 'الفروع', navUsers: 'المستخدمون', navRoles: 'الأدوار',
    kpiProducts: 'المنتجات', kpiStockValue: 'قيمة المخزون', kpiPendingOrders: 'طلبات معلقة',
    kpiLowStock: 'مخزون منخفض', kpiCategories: 'الفئات', kpiWarehouses: 'المستودعات',
    kpiSuppliers: 'الموردون', kpiEnterprises: 'المؤسسات', kpiBranches: 'الفروع',
    lowStockAlerts: 'تنبيهات المخزون المنخفض', stockByWarehouse: 'المخزون حسب المستودع', orderStatus: 'حالة الطلب',
    current: 'الحالي', reorderLevel: 'مستوى إعادة الطلب', deficit: 'العجز', utilization: 'الاستخدام',
    colSku: 'SKU', colName: 'الاسم', colCategory: 'الفئة', colPrice: 'السعر', colCost: 'التكلفة',
    colReorder: 'إعادة طلب', colStatus: 'الحالة', colActions: 'إجراءات', colProduct: 'المنتج',
    colWarehouse: 'المستودع', colQuantity: 'الكمية', colValue: 'القيمة', colType: 'النوع',
    colSupplier: 'المورد', colAmount: 'المبلغ', colNotes: 'ملاحظات', colLocation: 'الموقع',
    colCapacity: 'السعة', colContact: 'جهة اتصال', colEmail: 'البريد', colPhone: 'الهاتف',
    colRole: 'الدور', colEnterprise: 'المؤسسة', colBranch: 'الفرع', colActive: 'نشط', colId: 'رقم',
    add: 'إضافة', edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء', search: 'بحث',
    close: 'إغلاق', adjustStock: 'تعديل المخزون', newOrder: 'طلب جديد', apply: 'تطبيق',
    newProduct: 'منتج جديد', editProduct: 'تعديل منتج', newCategory: 'فئة جديدة',
    editCategory: 'تعديل فئة', newWarehouse: 'مستودع جديد', editWarehouse: 'تعديل مستودع',
    newSupplier: 'مورد جديد', editSupplier: 'تعديل مورد', newOrder_title: 'طلب جديد',
    editOrder: 'تعديل طلب', newEnterprise: 'مؤسسة جديدة', editEnterprise: 'تعديل مؤسسة',
    newBranch: 'فرع جديد', editBranch: 'تعديل فرع', newUser: 'مستخدم جديد', editUser: 'تعديل مستخدم',
    labelName: 'الاسم', labelDescription: 'الوصف', labelSku: 'SKU', labelUnit: 'الوحدة',
    labelCompanyName: 'اسم الشركة', labelContactPerson: 'جهة الاتصال', labelAddress: 'العنوان',
    labelOrderType: 'نوع الطلب', labelPurchaseOrder: 'طلب شراء', labelSalesOrder: 'طلب بيع',
    labelNone: 'لا شيء',
    statusActive: 'نشط', statusInactive: 'غير نشط', statusOk: 'جيد', statusLow: 'منخفض',
    login: 'تسجيل دخول', logout: 'تسجيل خروج', loginTitle: 'تسجيل الدخول', loginSubtitle: 'نظام إدارة المخزون',
    labelEmail: 'البريد الإلكتروني', labelPassword: 'كلمة المرور', loginButton: 'دخول', switchRole: 'تبديل الدور',
    currentRole: 'الدور الحالي',
    roleSuperAdmin: 'المدير الأعلى', roleEnterpriseAdmin: 'مدير المؤسسة',
    roleBranchAdmin: 'مدير الفرع', roleWarehouseAdmin: 'مدير المستودع', roleUser: 'مستخدم',
    permLabel: 'الصلاحيات', permProducts: 'المنتجات', permOrders: 'الطلبات', permStock: 'المخزون',
    permUsers: 'المستخدمون', permEnterprises: 'المؤسسات', permBranches: 'الفروع',
    permWarehouses: 'المستودعات', permCategories: 'الفئات', permSuppliers: 'الموردون',
    enterpriseAbilities: 'صلاحيات المؤسسة', enterpriseSettings: 'الإعدادات',
    loading: 'جاري تحميل البيانات...', noData: 'لا توجد بيانات', created: 'تم الإنشاء!',
    updated: 'تم التحديث!', deleted: 'تم الحذف', confirmDelete: 'هل أنت متأكد؟',
  },
  fr: {
    appName: 'Gestion des Stocks', appSubtitle: 'IMS Entreprise',
    navDashboard: 'Tableau de bord', navProducts: 'Produits', navStock: 'Stock', navOrders: 'Commandes',
    navWarehouses: 'Entrepôts', navSuppliers: 'Fournisseurs', navCategories: 'Catégories',
    navEnterprises: 'Entreprises', navBranches: 'Branches', navUsers: 'Utilisateurs', navRoles: 'Rôles',
    kpiProducts: 'Produits', kpiStockValue: 'Valeur du stock', kpiPendingOrders: 'Commandes en attente',
    kpiLowStock: 'Stock faible', kpiCategories: 'Catégories', kpiWarehouses: 'Entrepôts',
    kpiSuppliers: 'Fournisseurs', kpiEnterprises: 'Entreprises', kpiBranches: 'Branches',
    lowStockAlerts: 'Alertes stock faible', stockByWarehouse: 'Stock par entrepôt', orderStatus: 'Statut des commandes',
    current: 'Actuel', reorderLevel: 'Niveau de commande', deficit: 'Déficit', utilization: 'Utilisation',
    colSku: 'SKU', colName: 'Nom', colCategory: 'Catégorie', colPrice: 'Prix', colCost: 'Coût',
    colReorder: 'Réappro', colStatus: 'Statut', colActions: 'Actions', colProduct: 'Produit',
    colWarehouse: 'Entrepôt', colQuantity: 'Quantité', colValue: 'Valeur', colType: 'Type',
    colSupplier: 'Fournisseur', colAmount: 'Montant', colNotes: 'Notes', colLocation: 'Emplacement',
    colCapacity: 'Capacité', colContact: 'Contact', colEmail: 'Email', colPhone: 'Téléphone',
    colRole: 'Rôle', colEnterprise: 'Entreprise', colBranch: 'Branche', colActive: 'Actif', colId: 'ID',
    add: 'Ajouter', edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler', search: 'Rechercher',
    close: 'Fermer', adjustStock: 'Ajuster le stock', newOrder: 'Nouvelle commande', apply: 'Appliquer',
    newProduct: 'Nouveau produit', editProduct: 'Modifier produit', newCategory: 'Nouvelle catégorie',
    editCategory: 'Modifier catégorie', newWarehouse: 'Nouvel entrepôt', editWarehouse: "Modifier entrepôt",
    newSupplier: 'Nouveau fournisseur', editSupplier: 'Modifier fournisseur', newOrder_title: 'Nouvelle commande',
    editOrder: 'Modifier commande', newEnterprise: 'Nouvelle entreprise', editEnterprise: "Modifier entreprise",
    newBranch: 'Nouvelle branche', editBranch: 'Modifier branche', newUser: 'Nouvel utilisateur', editUser: "Modifier utilisateur",
    labelName: 'Nom', labelDescription: 'Description', labelSku: 'SKU', labelUnit: 'Unité',
    labelCompanyName: "Nom de l'entreprise", labelContactPerson: 'Personne contact', labelAddress: 'Adresse',
    labelOrderType: 'Type de commande', labelPurchaseOrder: 'Commande achat', labelSalesOrder: 'Commande vente',
    labelNone: 'Aucun',
    statusActive: 'Actif', statusInactive: 'Inactif', statusOk: 'OK', statusLow: 'Faible',
    login: 'Connexion', logout: 'Déconnexion', loginTitle: 'Connexion', loginSubtitle: 'Système de gestion des stocks',
    labelEmail: 'Email', labelPassword: 'Mot de passe', loginButton: 'Se connecter', switchRole: 'Changer rôle',
    currentRole: 'Rôle actuel',
    roleSuperAdmin: 'Super Admin', roleEnterpriseAdmin: "Admin d'entreprise",
    roleBranchAdmin: 'Admin de branche', roleWarehouseAdmin: "Admin d'entrepôt", roleUser: 'Utilisateur',
    permLabel: 'Permissions', permProducts: 'Produits', permOrders: 'Commandes', permStock: 'Stock',
    permUsers: 'Utilisateurs', permEnterprises: 'Entreprises', permBranches: 'Branches',
    permWarehouses: 'Entrepôts', permCategories: 'Catégories', permSuppliers: 'Fournisseurs',
    enterpriseAbilities: "Capacités d'entreprise", enterpriseSettings: 'Paramètres',
    loading: 'Chargement des données...', noData: 'Aucune donnée', created: 'Créé!',
    updated: 'Mis à jour!', deleted: 'Supprimé', confirmDelete: 'Êtes-vous sûr?',
  },
}

export function t(locale: Locale, key: keyof TranslationKeys): string {
  return translations[locale]?.[key] || translations.en[key] || key
}

export type { TranslationKeys }
