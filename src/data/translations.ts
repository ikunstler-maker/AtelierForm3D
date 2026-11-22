import { MeasurementCategory, MeasurementKey } from './measurementsSchema';
import {
  AnimeExpressionId,
  AnimeHairstyleId,
  HeadDisplayMode,
} from '../store/useAtelierStore';

export type Language = 'ua' | 'en';

export interface TranslationDictionary {
  appTitle: string;
  appSubtitle: string;
  gender: {
    female: string;
    male: string;
  };
  presets: {
    label: string;
    custom: string;
    'female-xs': string;
    'female-s': string;
    'female-m': string;
    'female-l': string;
    'male-s': string;
    'male-m': string;
    'male-l': string;
  };
  units: {
    cm: string;
    in: string;
  };
  header: {
    exportJson: string;
    importJson: string;
    casStudio: string;
    fitCheck: string;
    glassStyle: string;
    resetPreset: string;
    bgColorTooltip: string;
    headModeTooltip: string;
  };
  cas: {
    title: string;
    subtitle: string;
    animeModeToggle: string;
    headModeLabel: string;
    headModes: Record<HeadDisplayMode, string>;
    outlineThickness: string;
    shadowContrast: string;
    randomizeBtn: string;
    resetBtn: string;
    focusFaceBtn: string;
    tabs: {
      hair: string;
      eyes: string;
      face: string;
      skin: string;
    };
    hairstylesLabel: string;
    hairstyles: Record<AnimeHairstyleId, string>;
    hairColorLabel: string;
    bangsLength: string;
    backHairLength: string;
    hairVolume: string;
    ahogeToggle: string;
    eyeColorLabel: string;
    eyeSize: string;
    eyeSpacing: string;
    eyeTilt: string;
    pupilScale: string;
    sparkleIntensity: string;
    eyelashThickness: string;
    browHeight: string;
    browAngle: string;
    faceRoundness: string;
    chinSharpness: string;
    noseSize: string;
    noseHeight: string;
    mouthWidth: string;
    lipFullness: string;
    earSize: string;
    elfEarsToggle: string;
    expressionLabel: string;
    expressions: Record<AnimeExpressionId, string>;
    skinToneLabel: string;
    blushIntensity: string;
  };
  inspector: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    displayModeLabel: string;
    modes: {
      all: string;
      category: string;
      active: string;
    };
    showAll: string;
    hideAll: string;
    parametersCount: string;
    noResults: string;
    collapsePanel: string;
    expandPanel: string;
  };
  categories: Record<MeasurementCategory, string>;
  fitPanel: {
    title: string;
    subtitle: string;
    templateLabel: string;
    templates: {
      top: string;
      jacket: string;
      trousers: string;
      dress: string;
      all: string;
    };
    inputModeLabel: string;
    flatMode: string;
    fullGirthMode: string;
    flatBadge: string;
    bodyColumn: string;
    garmentColumn: string;
    deltaColumn: string;
    clearAll: string;
    loadSampleSize: string;
    legendTitle: string;
    statuses: {
      tight: string;
      snug: string;
      regular: string;
      oversized: string;
      unset: string;
    };
    statusDescriptions: {
      tight: string;
      snug: string;
      regular: string;
      oversized: string;
    };
  };
  customizer: {
    title: string;
    themeMode: string;
    darkGlass: string;
    lightGlass: string;
    canvasBackground: string;
    showStudioFloor: string;
    accentColor: string;
    backdropBlur: string;
    panelOpacity: string;
    surfaceFinish: string;
    finishes: {
      animeCel: string;
      clay: string;
      satin: string;
      translucent: string;
    };
    finishDescriptions: {
      animeCel: string;
      clay: string;
      satin: string;
      translucent: string;
    };
  };
  camera: {
    full: string;
    torso: string;
    sleeves: string;
    legs: string;
    back: string;
    reset: string;
    autoFocus: string;
  };
  measurements: Record<
    MeasurementKey,
    {
      name: string;
      tooltip: string;
    }
  >;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  ua: {
    appTitle: 'AtelierForm 3D',
    appSubtitle: 'Аніме CAS Студія та Параметричне Кравецьке Ательє',
    gender: {
      female: 'Жіночий',
      male: 'Чоловічий',
    },
    presets: {
      label: 'Типорозмір',
      custom: 'Індивідуальний',
      'female-xs': 'Жіночий XS (EU 34)',
      'female-s': 'Жіночий S (EU 36)',
      'female-m': 'Жіночий M (EU 38)',
      'female-l': 'Жіночий L (EU 40-42)',
      'male-s': 'Чоловічий S (EU 46)',
      'male-m': 'Чоловічий M (EU 48-50)',
      'male-l': 'Чоловічий L (EU 52-54)',
    },
    units: {
      cm: 'см',
      in: 'дюйм',
    },
    header: {
      exportJson: 'Експорт JSON',
      importJson: 'Імпорт JSON',
      casStudio: 'Аніме CAS',
      fitCheck: 'Перевірка Одягу',
      glassStyle: 'Фон та Стиль',
      resetPreset: 'Скинути',
      bgColorTooltip: 'Кастомний колір фону позаду манекена',
      headModeTooltip: 'Режим голови (Макет / Без голови / Аніме з волоссям)',
    },
    cas: {
      title: 'Редактор Персонажа (Anime CAS)',
      subtitle: 'Кастомізація тіла, контуру, зачісок та обличчя',
      animeModeToggle: 'Аніме стилізація тіла та світла',
      headModeLabel: 'Відображення голови (як у референсі)',
      headModes: {
        baldMannequin: 'Аніме-голова (Чистий манекен)',
        headless: 'Без голови (Зріз шиї)',
        animeFull: 'Повний образ (Зачіска + Очі)',
      },
      outlineThickness: 'Товщина чорного аніме-контуру (Ink Line)',
      shadowContrast: 'Глибина аніме Cel-тіней',
      randomizeBtn: 'Випадковий образ',
      resetBtn: 'За замовчуванням',
      focusFaceBtn: 'Камера на обличчя',
      tabs: {
        hair: 'Зачіски',
        eyes: 'Очі та Брови',
        face: 'Скульпт Обличчя',
        skin: 'Тіло та Світло',
      },
      hairstylesLabel: 'Модель зачіски (3D Волосся)',
      hairstyles: {
        twintails: 'Аніме Твінтейли (Два хвостики)',
        himeLong: 'Хіме-кат (Довге пряме з пасмами)',
        shortBob: 'Каре з чубчиком (Аніме Боб)',
        spikyShonen: 'Сьонен Спайки (Виразні пасма)',
        highPonytail: 'Високий кінський хвіст',
        wolfCut: 'Вулф-кат (Багатошаровий)',
        odangoBuns: 'Оданго (Два пучки з пасмами)',
        buzzNone: 'Без зачіски (Чиста голова)',
      },
      hairColorLabel: 'Палітра кольору волосся та відблисків',
      bangsLength: 'Довжина переднього чубчика',
      backHairLength: 'Довжина основних пасом / хвостів',
      hairVolume: 'Пишність та об’єм зачіски',
      ahogeToggle: 'Ахоге (фірмове верхнє пасмо-антена)',
      eyeColorLabel: 'Колір райдужки очей',
      eyeSize: 'Розмір аніме-очей',
      eyeSpacing: 'Відстань між очима',
      eyeTilt: 'Кут нахилу очей (Цундере / Лагідний)',
      pupilScale: 'Глибина зіниці та райдужки',
      sparkleIntensity: 'Яскравість аніме-блискіток в очах',
      eyelashThickness: 'Густота та вигин вій',
      browHeight: 'Висота посадки брів',
      browAngle: 'Нахил брів (Емоційний акцент)',
      faceRoundness: 'Форма щік та повнота обличчя',
      chinSharpness: 'Гострота V-підборіддя (Аніме контур)',
      noseSize: 'Делікатність / розмір носа',
      noseHeight: 'Висота перенісся та кінчика носа',
      mouthWidth: 'Ширина рота та посмішки',
      lipFullness: 'Пухкість верхньої та нижньої губи',
      earSize: 'Розмір вух',
      elfEarsToggle: 'Ельфійські загострені вушка (Фентезі)',
      expressionLabel: 'Емоція та вираз обличчя',
      expressions: {
        gentleSmile: 'Лагідна аніме-посмішка',
        neutralCalm: 'Спокійний / Зосереджений',
        cheerfulOpen: 'Радісний / Відкритий',
        seriousCool: 'Холоднокровний / Серйозний',
        shyBlush: 'Сором’язливий з рум’янцем',
      },
      skinToneLabel: 'Відтінок поверхні тіла (Cel-Shading)',
      blushIntensity: 'Інтенсивність рум’янцю на щоках',
    },
    inspector: {
      title: 'Антропометрія Тіла',
      subtitle: '50 кравецьких параметрів у реальному часі',
      searchPlaceholder: 'Пошук мірки (напр. талія, рукав, кроковий)...',
      displayModeLabel: 'Відображення 3D ліній',
      modes: {
        all: 'Усі мірки',
        category: 'За категоріями',
        active: 'Лише активна',
      },
      showAll: 'Показати всі',
      hideAll: 'Сховати всі',
      parametersCount: 'мірок',
      noResults: 'Мірок за запитом не знайдено',
      collapsePanel: 'Згорнути панель',
      expandPanel: 'Розгорнути панель мірок',
    },
    categories: {
      circumferences: 'Обхвати',
      torso: 'Торс та Плечі',
      sleeves: 'Рукави',
      legs: 'Штани та Посадка',
      heights: 'Висоти',
      extremities: 'Кисті та Стопи',
    },
    fitPanel: {
      title: 'Верифікація Розміру Одягу',
      subtitle: 'Порівняння замірів виробу з параметрами 3D манекена',
      templateLabel: 'Категорія виробу',
      templates: {
        top: 'Сорочка / Топ / Светр',
        jacket: 'Жакет / Пальто / Куртка',
        trousers: 'Штани / Джинси',
        dress: 'Сукня / Спідниця',
        all: 'Усі 50 параметрів',
      },
      inputModeLabel: 'Спосіб заміру обхватів',
      flatMode: 'Напівобхват на столі (x2)',
      fullGirthMode: 'Повний обхват (x1)',
      flatBadge: 'x2 до повного',
      bodyColumn: 'Тіло',
      garmentColumn: 'Виріб',
      deltaColumn: 'Свобода',
      clearAll: 'Очистити',
      loadSampleSize: 'Заповнити еталон',
      legendTitle: 'Шкала свободи облягання (Виріб - Тіло)',
      statuses: {
        tight: 'Тісно / Коротко',
        snug: 'Щільно по фігурі',
        regular: 'Комфортна посадка',
        oversized: 'Вільний / Оверсайз',
        unset: 'Не задано',
      },
      statusDescriptions: {
        tight: '< 0 см (менше за тіло)',
        snug: '0 ... +2.5 см (прилягаючий силует)',
        regular: '+3.0 ... +8.0 см (класичний баланс)',
        oversized: '> +8.0 см (вільний крій)',
      },
    },
    customizer: {
      title: 'Фон, Світло та Liquid Glass',
      themeMode: 'Режим інтерфейсу',
      darkGlass: 'Темне Скло',
      lightGlass: 'Світле Скло',
      canvasBackground: 'Колір фону позаду манекена',
      showStudioFloor: 'Показувати подіум та сітку підлоги',
      accentColor: 'Акцентний спектр UI',
      backdropBlur: 'Глибина розмиття скла',
      panelOpacity: 'Щільність панелей',
      surfaceFinish: 'Шейдер освітлення 3D тіла',
      finishes: {
        animeCel: 'Аніме Cel-Shading (Як на референсі)',
        clay: 'Матова Скульптурна Глина',
        satin: 'М’який Сатин (SSS Шкіра)',
        translucent: 'Напівпрозора Оболонка',
      },
      finishDescriptions: {
        animeCel: 'Чіткі двотонові аніме-тіні + тушовий контур (ACON / Clip Studio стиль)',
        clay: 'Архітектурна скульптурна поверхня без відблисків',
        satin: 'Делікатний студійний шейдер шкіри з м’яким Френелем',
        translucent: 'Просвічує внутрішні шви рукава та кроковий шов',
      },
    },
    camera: {
      full: 'Повний зріст',
      torso: 'Обличчя / Торс',
      sleeves: 'Рукави',
      legs: 'Штани та Крок',
      back: 'Спина',
      reset: 'Скинути ракурс',
      autoFocus: 'Автофокус на мірці',
    },
    measurements: {
      totalHeight: {
        name: 'Загальний зріст',
        tooltip: 'Вертикальна відстань від підлоги до верхівки голови',
      },
      cervicaleHeight: {
        name: 'Висота шийної точки (C7)',
        tooltip: 'Від підлоги до сьомого шийного хребця ззаду',
      },
      shoulderHeight: {
        name: 'Висота плечової точки',
        tooltip: 'Від підлоги до зовнішнього краю акроміона плеча',
      },
      chestHeight: {
        name: 'Висота лінії грудей',
        tooltip: 'Від підлоги до найбільш виступаючої точки грудей',
      },
      underbustHeight: {
        name: 'Висота під грудьми',
        tooltip: 'Від підлоги до основи грудної залози / нижнього контуру грудей',
      },
      waistHeight: {
        name: 'Висота лінії талії',
        tooltip: 'Від підлоги до природного звуження талії',
      },
      highHipHeight: {
        name: 'Висота верхніх стегон',
        tooltip: 'Від підлоги до рівня клубових гребенів тазу',
      },
      hipHeight: {
        name: 'Висота лінії стегон',
        tooltip: 'Від підлоги до найбільш виступаючих точок сідниць',
      },
      crotchHeight: {
        name: 'Висота паху (кроку)',
        tooltip: 'Вертикальна висота від підлоги до промежини',
      },
      kneeHeight: {
        name: 'Висота коліна',
        tooltip: 'Від підлоги до центру колінної чашечки',
      },
      head: {
        name: 'Обхват голови',
        tooltip: 'Горизонтальний обхват через надбрівні дуги та потилицю',
      },
      neck: {
        name: 'Обхват основи шиї',
        tooltip: 'По основі шиї через сьомий шийний хребець та яремну западину',
      },
      upperChest: {
        name: 'Обхват верхніх грудей',
        tooltip: 'Горизонтально на рівні пахвових складок вище центру грудей',
      },
      chest: {
        name: 'Обхват грудей (повний)',
        tooltip: 'Горизонтальний обхват по виступаючих точках грудей та лопатках',
      },
      underbust: {
        name: 'Обхват під грудьми',
        tooltip: 'Горизонтальний обхват грудної клітки безпосередньо під грудьми',
      },
      waist: {
        name: 'Обхват талії',
        tooltip: 'Горизонтальний обхват по найвужчій лінії природної талії',
      },
      highHip: {
        name: 'Обхват верхніх стегон',
        tooltip: 'Проміжний обхват тазу на 8–10 см нижче лінії талії',
      },
      hip: {
        name: 'Обхват стегон',
        tooltip: 'Максимальний горизонтальний обхват через сідниці та стегна',
      },
      thigh: {
        name: 'Обхват стегна (верхній)',
        tooltip: 'Горизонтальний обхват ноги безпосередньо під сідничною складкою',
      },
      midThigh: {
        name: 'Обхват середини стегна',
        tooltip: 'Горизонтальний обхват посередині між пахом та коліном',
      },
      knee: {
        name: 'Обхват коліна',
        tooltip: 'Горизонтальний обхват через центр колінної чашечки',
      },
      calf: {
        name: 'Обхват литки',
        tooltip: 'Максимальний горизонтальний обхват литкового м’яза',
      },
      ankle: {
        name: 'Обхват щиколотки',
        tooltip: 'Мінімальний обхват гомілки безпосередньо над кісточками',
      },
      bicep: {
        name: 'Обхват плеча (біцепса)',
        tooltip: 'Горизонтальний обхват верхньої частини руки у найширшому місці',
      },
      elbow: {
        name: 'Обхват ліктя',
        tooltip: 'Обхват руки на рівні ліктьового суглоба',
      },
      forearm: {
        name: 'Обхват передпліччя',
        tooltip: 'Максимальний обхват верхньої третини передпліччя',
      },
      wrist: {
        name: 'Обхват зап’ястя',
        tooltip: 'Обхват по дистальній складці зап’ястя за кісточками',
      },
      shoulderWidth: {
        name: 'Ширина плечей (біакроміальна)',
        tooltip: 'Поверхнева дуга між лівою та правою плечовими точками',
      },
      singleShoulderLength: {
        name: 'Довжина плечового ската',
        tooltip: 'Від бічної точки основи шиї до кінчика плеча (акроміона)',
      },
      acrossFrontWidth: {
        name: 'Ширина грудей спереду',
        tooltip: 'Горизонтально між передніми кутами пахвових западин',
      },
      acrossBackWidth: {
        name: 'Ширина спини',
        tooltip: 'Горизонтально по лопатках між задніми кутами пахв',
      },
      frontWaistLength: {
        name: 'Довжина переду до талії',
        tooltip: 'Від основи шиї через вищу точку грудей вертикально до талії',
      },
      backWaistLength: {
        name: 'Довжина спинки до талії',
        tooltip: 'Від сьомого шийного хребця C7 вздовж хребта до лінії талії',
      },
      sideTorsoLength: {
        name: 'Довжина бокового шва торсу',
        tooltip: 'Від нижнього краю пахвової западини вертикально до талії',
      },
      torsoLoop: {
        name: 'Вертикальна дуга торсу',
        tooltip: 'Повна петля від плеча через пах і по спині назад до плеча',
      },
      sleeveFromShoulder: {
        name: 'Довжина рукава від плеча',
        tooltip: 'Від кінчика плеча (акроміона) через лікоть до зап’ястя',
      },
      sleeveFromNeck: {
        name: 'Довжина рукава від шиї (реглан)',
        tooltip: 'Від центру шиї ззаду (C7) через плече вздовж руки до зап’ястя',
      },
      sleeveFromArmpit: {
        name: 'Внутрішній шов рукава (від пахви)',
        tooltip: 'Від пахвової западини по внутрішній стороні руки до зап’ястя',
      },
      shoulderToElbow: {
        name: 'Довжина від плеча до ліктя',
        tooltip: 'Від плечової точки акроміона до середини ліктьового суглоба',
      },
      outseamFromWaist: {
        name: 'Боковий шов штанів від талії',
        tooltip: 'Від лінії талії по зовнішньому контуру стегна до щиколотки',
      },
      outseamFromHighHip: {
        name: 'Боковий шов від верхніх стегон',
        tooltip: 'Від пояса на рівні верхніх стегон по зовнішньому шву до щиколотки',
      },
      inseamLength: {
        name: 'Кроковий шов (внутрішній шов штанів)',
        tooltip: 'Від точки паху по внутрішній поверхні ноги до щиколотки',
      },
      waistToKneeLength: {
        name: 'Довжина від талії до коліна',
        tooltip: 'Від бічної точки талії по зовнішньому контуру стегна до рівня коліна',
      },
      crotchCurveTotal: {
        name: 'Загальна дуга сидіння (паху)',
        tooltip: 'Від талії спереду через пах до талії ззаду (передня + задня посадка)',
      },
      frontRise: {
        name: 'Висота посадки спереду (Front Rise)',
        tooltip: 'Поверхнева крива від центру талії спереду до нижньої точки паху',
      },
      backRise: {
        name: 'Висота посадки ззаду (Back Rise)',
        tooltip: 'Поверхнева крива від центру талії ззаду через сідниці до точки паху',
      },
      handLength: {
        name: 'Довжина кисті руки',
        tooltip: 'Від складки зап’ястя до кінчика середнього пальця',
      },
      handWidth: {
        name: 'Ширина долоні',
        tooltip: 'Поперечна ширина долоні на рівні п’ясткових кісточок',
      },
      footLength: {
        name: 'Довжина стопи',
        tooltip: 'Від крайньої точки п’яти до кінчика найдовшого пальця стопи',
      },
      footWidth: {
        name: 'Ширина стопи',
        tooltip: 'Максимальна ширина пучкової частини стопи',
      },
    },
  },
  en: {
    appTitle: 'AtelierForm 3D',
    appSubtitle: 'Anime CAS Studio & Parametric Tailoring Fit Verifier',
    gender: {
      female: 'Female',
      male: 'Male',
    },
    presets: {
      label: 'Body Preset',
      custom: 'Custom Profile',
      'female-xs': 'Female XS (EU 34)',
      'female-s': 'Female S (EU 36)',
      'female-m': 'Female M (EU 38)',
      'female-l': 'Female L (EU 40-42)',
      'male-s': 'Male S (EU 46)',
      'male-m': 'Male M (EU 48-50)',
      'male-l': 'Male L (EU 52-54)',
    },
    units: {
      cm: 'cm',
      in: 'in',
    },
    header: {
      exportJson: 'Export JSON',
      importJson: 'Import JSON',
      casStudio: 'Anime CAS',
      fitCheck: 'Garment Fit Check',
      glassStyle: 'Backdrop & Style',
      resetPreset: 'Reset',
      bgColorTooltip: 'Custom background color behind the mannequin',
      headModeTooltip: 'Head Mode (Bald Mannequin / Headless / Full Anime)',
    },
    cas: {
      title: 'Character Studio (Anime CAS)',
      subtitle: 'Customize body shading, ink outline, hairstyles & face',
      animeModeToggle: 'Anime Body & Cel-Shading Active',
      headModeLabel: 'Head Display Mode (Reference Menu)',
      headModes: {
        baldMannequin: 'Anime Head (Clean Drawing Base)',
        headless: 'Headless (Collar Neck Cut)',
        animeFull: 'Full Character (Hair + Anime Eyes)',
      },
      outlineThickness: 'Anime Ink Contour Line Thickness',
      shadowContrast: 'Anime Cel-Shadow Depth',
      randomizeBtn: 'Randomize Look',
      resetBtn: 'Reset Default',
      focusFaceBtn: 'Zoom to Head / Face',
      tabs: {
        hair: 'Hairstyles',
        eyes: 'Eyes & Brows',
        face: 'Face Sculpt',
        skin: 'Body & Shading',
      },
      hairstylesLabel: '3D Anime Hairstyle',
      hairstyles: {
        twintails: 'Anime Twintails (Long Ribbons)',
        himeLong: 'Hime Cut (Long Straight + Side Locks)',
        shortBob: 'Anime Short Bob with Bangs',
        spikyShonen: 'Spiky Shonen Layered',
        highPonytail: 'High Flowing Ponytail',
        wolfCut: 'Textured Anime Wolf Cut',
        odangoBuns: 'Odango Double Buns + Strands',
        buzzNone: 'No Hair (Bald Mannequin)',
      },
      hairColorLabel: 'Hair Color & Specular Highlights',
      bangsLength: 'Front Bangs / Fringe Length',
      backHairLength: 'Main Locks / Tails Length',
      hairVolume: 'Hair Volume & Fullness',
      ahogeToggle: 'Top Ahoge Cowlick Strand',
      eyeColorLabel: 'Iris Color Spectrum',
      eyeSize: 'Anime Eye Scale',
      eyeSpacing: 'Inter-Ocular Eye Spacing',
      eyeTilt: 'Eye Canthal Tilt Angle',
      pupilScale: 'Iris & Pupil Depth',
      sparkleIntensity: 'Anime Eye Starlight Sparkles',
      eyelashThickness: 'Upper Eyelash Wing Thickness',
      browHeight: 'Eyebrow Vertical Offset',
      browAngle: 'Eyebrow Expression Angle',
      faceRoundness: 'Cheek Fullness & Face Softness',
      chinSharpness: 'Anime V-Shape Chin Taper',
      noseSize: 'Anime Nose Delicacy',
      noseHeight: 'Nose Bridge & Tip Elevation',
      mouthWidth: 'Mouth & Smile Width',
      lipFullness: 'Upper & Lower Lip Fullness',
      earSize: 'Ear Scale',
      elfEarsToggle: 'Pointed Fantasy Elf Ears',
      expressionLabel: 'Facial Expression Preset',
      expressions: {
        gentleSmile: 'Gentle Anime Smile',
        neutralCalm: 'Serene / Calm',
        cheerfulOpen: 'Cheerful / Bright',
        seriousCool: 'Cool / Determined',
        shyBlush: 'Shy / Flustered Blush',
      },
      skinToneLabel: 'Surface Base Tone (Cel-Shaded)',
      blushIntensity: 'Cheek Anime Blush Intensity',
    },
    inspector: {
      title: 'Body Anthropometry',
      subtitle: '50 real-time tailoring parameters',
      searchPlaceholder: 'Search parameter (e.g. waist, sleeve, inseam)...',
      displayModeLabel: '3D Overlay Mode',
      modes: {
        all: 'All Measurements',
        category: 'Category Filter',
        active: 'Active Only',
      },
      showAll: 'Show All',
      hideAll: 'Hide All',
      parametersCount: 'params',
      noResults: 'No matching measurements found',
      collapsePanel: 'Collapse inspector',
      expandPanel: 'Expand measurements inspector',
    },
    categories: {
      circumferences: 'Circumferences',
      torso: 'Torso & Shoulders',
      sleeves: 'Sleeves',
      legs: 'Legs & Rise',
      heights: 'Heights',
      extremities: 'Extremities',
    },
    fitPanel: {
      title: 'Garment Size Verification',
      subtitle: 'Compare store size chart against 3D mannequin anatomy',
      templateLabel: 'Garment Template',
      templates: {
        top: 'Top / Shirt / Knit',
        jacket: 'Jacket / Coat / Blazer',
        trousers: 'Trousers / Jeans',
        dress: 'Dress / Skirt',
        all: 'All 50 Parameters',
      },
      inputModeLabel: 'Girth Measurement Method',
      flatMode: 'Flat Lay (x2 for girths)',
      fullGirthMode: 'Full Girth (x1)',
      flatBadge: 'x2 full girth',
      bodyColumn: 'Body',
      garmentColumn: 'Garment',
      deltaColumn: 'Ease / Delta',
      clearAll: 'Clear Inputs',
      loadSampleSize: 'Fill Sample Garment',
      legendTitle: 'Ease & Fit Classification (Garment - Body)',
      statuses: {
        tight: 'Too Tight / Short',
        snug: 'Snug / Form-Fitting',
        regular: 'Regular Comfort Fit',
        oversized: 'Relaxed / Oversized',
        unset: 'No Value',
      },
      statusDescriptions: {
        tight: '< 0 cm (negative ease)',
        snug: '0 to +2.5 cm (close contour fit)',
        regular: '+3.0 to +8.0 cm (tailored standard ease)',
        oversized: '> +8.0 cm (generous drape)',
      },
    },
    customizer: {
      title: 'Backdrop, Shading & Glass',
      themeMode: 'Interface Appearance',
      darkGlass: 'Dark Liquid Glass',
      lightGlass: 'Light Liquid Glass',
      canvasBackground: 'Custom Background Color Behind Body',
      showStudioFloor: 'Show Floor Pedestal & Grid',
      accentColor: 'UI Accent Spectrum',
      backdropBlur: 'Glass Backdrop Blur',
      panelOpacity: 'Glass Surface Opacity',
      surfaceFinish: 'Mannequin Lighting Shader',
      finishes: {
        animeCel: 'Anime Cel-Shading (Reference Match)',
        clay: 'Matte Sculptural Clay',
        satin: 'Anime Satin (SSS Skin)',
        translucent: 'Translucent Shell',
      },
      finishDescriptions: {
        animeCel: 'Crisp 2-tone cel shadows + charcoal ink outline (ACON / CSP style)',
        clay: 'Architectural diffuse sculpture with soft studio shadows',
        satin: 'Smooth anime skin shader with subtle Fresnel sheen',
        translucent: 'Semi-transparent shell revealing inseam & underarm seams',
      },
    },
    camera: {
      full: 'Full Body',
      torso: 'Face & Torso',
      sleeves: 'Sleeves',
      legs: 'Legs & Rise',
      back: 'Back View',
      reset: 'Reset Orbit',
      autoFocus: 'Auto-Focus Selected',
    },
    measurements: {
      totalHeight: {
        name: 'Total Stature Height',
        tooltip: 'Vertical distance from floor plane to crown vertex of head',
      },
      cervicaleHeight: {
        name: 'Cervicale Height (C7)',
        tooltip: 'Vertical height from floor to prominent C7 neck vertebra',
      },
      shoulderHeight: {
        name: 'Acromion Shoulder Height',
        tooltip: 'Vertical height from floor to lateral shoulder tip',
      },
      chestHeight: {
        name: 'Bust / Chest Height',
        tooltip: 'Vertical height from floor to chest/bust apex level',
      },
      underbustHeight: {
        name: 'Underbust Height',
        tooltip: 'Vertical height from floor to inframammary ribcage fold',
      },
      waistHeight: {
        name: 'Natural Waist Height',
        tooltip: 'Vertical height from floor to narrowest natural waist line',
      },
      highHipHeight: {
        name: 'High Hip Height',
        tooltip: 'Vertical height from floor to anterior iliac crest level',
      },
      hipHeight: {
        name: 'Full Hip Height',
        tooltip: 'Vertical height from floor to fullest gluteal prominence',
      },
      crotchHeight: {
        name: 'Crotch / Inseam Height',
        tooltip: 'Vertical distance from floor plane to perineal crotch apex',
      },
      kneeHeight: {
        name: 'Knee Center Height',
        tooltip: 'Vertical distance from floor plane to mid-patella knee center',
      },
      head: {
        name: 'Head Circumference',
        tooltip: 'Horizontal perimeter across brow ridge and occipital bone',
      },
      neck: {
        name: 'Neck Base Circumference',
        tooltip: 'Collar girth passing over C7 vertebra and suprasternal notch',
      },
      upperChest: {
        name: 'Upper Chest Circumference',
        tooltip: 'Horizontal torso girth at axillary fold level above full bust',
      },
      chest: {
        name: 'Chest / Bust Circumference',
        tooltip: 'Maximum horizontal girth across bust/chest apex and scapulae',
      },
      underbust: {
        name: 'Underbust Circumference',
        tooltip: 'Horizontal ribcage circumference immediately below bust',
      },
      waist: {
        name: 'Natural Waist Circumference',
        tooltip: 'Horizontal girth around the narrowest natural waist crease',
      },
      highHip: {
        name: 'High Hip Circumference',
        tooltip: 'Upper pelvic circumference 8-10 cm below natural waist',
      },
      hip: {
        name: 'Full Hip / Seat Circumference',
        tooltip: 'Maximum horizontal perimeter across hip bones and glutes',
      },
      thigh: {
        name: 'Upper Thigh Circumference',
        tooltip: 'Maximum proximal thigh girth directly below gluteal fold',
      },
      midThigh: {
        name: 'Mid-Thigh Circumference',
        tooltip: 'Horizontal leg girth halfway between crotch and knee',
      },
      knee: {
        name: 'Knee Circumference',
        tooltip: 'Articular circumference centered across patella',
      },
      calf: {
        name: 'Calf Circumference',
        tooltip: 'Maximum horizontal girth around gastrocnemius calf muscle',
      },
      ankle: {
        name: 'Ankle Circumference',
        tooltip: 'Minimum lower leg girth just above ankle malleoli',
      },
      bicep: {
        name: 'Bicep / Upper Arm Girth',
        tooltip: 'Horizontal circumference around mid-upper arm',
      },
      elbow: {
        name: 'Elbow Circumference',
        tooltip: 'Articular circumference passing over elbow olecranon',
      },
      forearm: {
        name: 'Forearm Circumference',
        tooltip: 'Maximum proximal forearm girth below elbow',
      },
      wrist: {
        name: 'Wrist Circumference',
        tooltip: 'Circumference across distal wrist crease and styloid bone',
      },
      shoulderWidth: {
        name: 'Bi-Acromial Shoulder Width',
        tooltip: 'Posterior contour span from left shoulder tip to right shoulder tip',
      },
      singleShoulderLength: {
        name: 'Single Shoulder Seam Length',
        tooltip: 'Distance from lateral neck base to acromion shoulder tip',
      },
      acrossFrontWidth: {
        name: 'Across Chest Front Width',
        tooltip: 'Anterior width from left to right front armhole crease',
      },
      acrossBackWidth: {
        name: 'Across Back Width',
        tooltip: 'Posterior width across shoulder blades between back armhole creases',
      },
      frontWaistLength: {
        name: 'Front Neck-to-Waist Length',
        tooltip: 'Side neck base over bust projection down to front waist line',
      },
      backWaistLength: {
        name: 'Back C7-to-Waist Length',
        tooltip: 'Cervicale C7 vertebra along spine contour to back waist line',
      },
      sideTorsoLength: {
        name: 'Side Seam (Armpit to Waist)',
        tooltip: 'Vertical torso side seam from axillary fold down to waist',
      },
      torsoLoop: {
        name: 'Vertical Torso Trunk Loop',
        tooltip: 'Complete vertical trunk loop from shoulder through crotch and up back',
      },
      sleeveFromShoulder: {
        name: 'Outer Sleeve (Shoulder to Wrist)',
        tooltip: 'Shoulder tip over slightly bent outer elbow down to wrist bone',
      },
      sleeveFromNeck: {
        name: 'Raglan Sleeve (C7 Neck to Wrist)',
        tooltip: 'Center-back C7 neck over shoulder tip down outer arm to wrist',
      },
      sleeveFromArmpit: {
        name: 'Inner Sleeve Seam (Armpit to Wrist)',
        tooltip: 'Underarm axillary crease along inner sleeve seam to wrist',
      },
      shoulderToElbow: {
        name: 'Shoulder to Elbow Length',
        tooltip: 'Acromion shoulder point to lateral elbow joint',
      },
      outseamFromWaist: {
        name: 'Trouser Outseam (from Waist)',
        tooltip: 'Lateral waist over outer hip curve down to ankle malleolus',
      },
      outseamFromHighHip: {
        name: 'Low-Waist Outseam (from High Hip)',
        tooltip: 'Lateral high-hip waistband level down outer leg to ankle',
      },
      inseamLength: {
        name: 'Trouser Inseam (Crotch to Ankle)',
        tooltip: 'Inner leg seam from perineal crotch apex down to inner ankle',
      },
      waistToKneeLength: {
        name: 'Waist to Knee Length',
        tooltip: 'Lateral natural waist down outer thigh to mid-knee level',
      },
      crotchCurveTotal: {
        name: 'Total Crotch Saddle Rise',
        tooltip: 'Full U-curve from center-front waist through crotch to center-back waist',
      },
      frontRise: {
        name: 'Front Rise (Waist to Crotch)',
        tooltip: 'Anterior rise from center-front waist curve to perineal crotch seam',
      },
      backRise: {
        name: 'Back Rise (Back Waist to Crotch)',
        tooltip: 'Posterior rise from center-back waist over gluteal curve to crotch seam',
      },
      handLength: {
        name: 'Hand Length',
        tooltip: 'Distal wrist crease to tip of middle finger',
      },
      handWidth: {
        name: 'Palm Width',
        tooltip: 'Transverse palm breadth across metacarpal knuckles',
      },
      footLength: {
        name: 'Foot Length',
        tooltip: 'Posterior heel to tip of longest toe',
      },
      footWidth: {
        name: 'Foot Width',
        tooltip: 'Transverse ball breadth across widest part of foot',
      },
    },
  },
};
