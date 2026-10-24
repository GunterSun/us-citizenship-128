import pypdf, re, json

reader = pypdf.PdfReader('/Users/guntersun/Downloads/美国公民入籍考试128题精编手册.pdf')

full_text = ''
for i, page in enumerate(reader.pages):
    full_text += f'\n=== PAGE {i+1} ===\n' + page.extract_text()

# Full 128 Questions Definition with authoritative USCIS content & specialized aids for Chinese learners
# Pre-defined complete master database for 100% accuracy, keywords, and pronunciation aids
master_data = {}

# Supplements for edge cases and clean canonical answers:
canonical_records = {
    1: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What is the form of government of the United States?",
        "qZh": "美国的政体是什么？",
        "aEn": "Republic / Representative democracy",
        "aZh": "共和制 / 代议制民主",
        "keywords": "form of government",
        "tip": "抓听: form of government (政体) -> 答: Republic (瑞帕伯利克 / 共和制)"
    },
    2: {
        "starred": True,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What is the supreme law of the land?",
        "qZh": "美国的最高法律是什么？",
        "aEn": "(U.S.) Constitution",
        "aZh": "（美国）宪法",
        "keywords": "supreme law",
        "tip": "抓听: supreme law (最高法律) -> 答: Constitution (康斯提丢申 / 宪法)"
    },
    3: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Name one thing the U.S. Constitution does.",
        "qZh": "宪法的作用是什么？（任答一项）",
        "aEn": "Forms the government / Defines powers",
        "aZh": "建立政府 / 定义政府权力",
        "keywords": "Constitution does",
        "tip": "抓听: Constitution does (宪法作用) -> 答: Forms the government (建立政府)"
    },
    4: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "The Constitution starts with \"We the People.\" What does it mean?",
        "qZh": "宪法以“我们人民”开头，是什么意思？",
        "aEn": "Self-government / Popular sovereignty",
        "aZh": "自治政府 / 人民主权",
        "keywords": "We the People · mean",
        "tip": "抓听: We the People (我们人民) -> 答: Self-government (塞夫 戈文门特 / 自治政府)"
    },
    5: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "How are changes made to the U.S. Constitution?",
        "qZh": "美国宪法是如何修改的？",
        "aEn": "Amendments (The amendment process)",
        "aZh": "通过修正案（修宪程序）",
        "keywords": "changes made · Constitution",
        "tip": "抓听: changes made (修改宪法) -> 答: Amendments (阿门德门茨 / 修正案)"
    },
    6: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What does the Bill of Rights protect?",
        "qZh": "《权利法案》保护的是什么？",
        "aEn": "(The basic) rights of Americans",
        "aZh": "美国人的（基本）权利",
        "keywords": "Bill of Rights protect",
        "tip": "抓听: Bill of Rights (权利法案) -> 答: Rights of Americans (美国人的权利)"
    },
    7: {
        "starred": True,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "How many amendments does the U.S. Constitution have?",
        "qZh": "美国宪法有多少条修正案？",
        "aEn": "27 (Twenty-seven)",
        "aZh": "27 条",
        "keywords": "how many amendments",
        "tip": "抓听: how many amendments (多少条修正案) -> 答: Twenty-seven (27)"
    },
    8: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Why is the Declaration of Independence important?",
        "qZh": "《独立宣言》为什么重要？",
        "aEn": "It says America is free from British control.",
        "aZh": "宣告美国脱离英国控制而独立",
        "keywords": "Declaration of Independence important",
        "tip": "抓听: Declaration of Independence (独立宣言重要) -> 答: America is free from British control"
    },
    9: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What founding document said the colonies were free from Britain?",
        "qZh": "哪份建国文件宣告十三殖民地脱离英国？",
        "aEn": "Declaration of Independence",
        "aZh": "《独立宣言》",
        "keywords": "colonies free from Britain",
        "tip": "抓听: free from Britain (脱离英国) -> 答: Declaration of Independence"
    },
    10: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Name two ideas from Declaration of Independence and Constitution.",
        "qZh": "列举两项源自两份重要文件的核心思想。",
        "aEn": "Liberty · Self-government",
        "aZh": "自由 · 人民自治",
        "keywords": "two ideas · Declaration · Constitution",
        "tip": "抓听: two ideas (两个思想) -> 答: Liberty, Self-government (自由与自治)"
    },
    11: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "\"Life, Liberty, and pursuit of Happiness\" are in what document?",
        "qZh": "“生命、自由与追求幸福”出现在哪份文件？",
        "aEn": "Declaration of Independence",
        "aZh": "《独立宣言》",
        "keywords": "Life, Liberty · Happiness",
        "tip": "抓听: Life, Liberty, Happiness (生命自由幸福) -> 答: Declaration of Independence"
    },
    12: {
        "starred": True,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What is the economic system of the United States?",
        "qZh": "美国的经济制度是什么？",
        "aEn": "Capitalism / Free market economy",
        "aZh": "资本主义 / 自由市场经济",
        "keywords": "economic system",
        "tip": "抓听: economic system (经济制度) -> 答: Capitalism (开普妥利森 / 资本主义)"
    },
    13: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What is the rule of law?",
        "qZh": "什么是法治（Rule of Law）？",
        "aEn": "Everyone must follow the law.",
        "aZh": "人人必须守法 / 没有任何人凌驾于法律之上",
        "keywords": "rule of law",
        "tip": "抓听: rule of law (法治) -> 答: Everyone must follow the law (人人守法)"
    },
    14: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Many documents influenced the U.S. Constitution. Name one.",
        "qZh": "列举一份影响了美国宪法的文件。",
        "aEn": "Declaration of Independence",
        "aZh": "《独立宣言》 / 《联邦论》",
        "keywords": "influenced Constitution",
        "tip": "抓听: influenced Constitution (影响宪法) -> 答: Declaration of Independence"
    },
    15: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "There are three branches of government. Why?",
        "qZh": "政府分为三个分支部门，为什么？",
        "aEn": "Checks and balances / Separation of powers",
        "aZh": "分权与制衡 / 防止单一部门过权",
        "keywords": "three branches · why",
        "tip": "抓听: three branches, why (为何分三权) -> 答: Checks and balances (制衡)"
    },
    16: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Name the three branches of government.",
        "qZh": "列举政府的三个部门。",
        "aEn": "Congress, president, and the courts",
        "aZh": "立法（国会）、行政（总统）、司法（法院）",
        "keywords": "name three branches",
        "tip": "抓听: Name three branches (列举三部门) -> 答: Congress, president, courts"
    },
    17: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "The President is in charge of which branch of government?",
        "qZh": "美国总统主管哪个政府部门？",
        "aEn": "Executive branch",
        "aZh": "行政部门",
        "keywords": "President in charge",
        "tip": "抓听: President in charge (总统管哪个部门) -> 答: Executive branch (行政)"
    },
    18: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What part of the federal government writes laws?",
        "qZh": "联邦政府的哪一部分负责制定法律？",
        "aEn": "(U.S.) Congress",
        "aZh": "（美国）国会",
        "keywords": "writes laws",
        "tip": "抓听: writes laws (制定法律) -> 答: Congress (康格里斯 / 国会)"
    },
    19: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "What are the two parts of the U.S. Congress?",
        "qZh": "美国国会由哪两部分组成？",
        "aEn": "Senate and House of Representatives",
        "aZh": "参议院与众议院",
        "keywords": "two parts of Congress",
        "tip": "抓听: two parts of Congress (国会两部分) -> 答: Senate and House (参院与众院)"
    },
    20: {
        "starred": False,
        "part": "PART 1: AMERICAN GOVERNMENT · 美国政府",
        "category": "A: Principles of American Government · 民主原则",
        "qEn": "Name one power of the U.S. Congress.",
        "qZh": "列举美国国会的一项法定权力。",
        "aEn": "Writes laws / Declares war / Makes federal budget",
        "aZh": "制定法律 / 宣战 / 制定联邦预算",
        "keywords": "power of Congress",
        "tip": "抓听: power of Congress (国会权力) -> 答: Writes laws (制定法律)"
    }
}

