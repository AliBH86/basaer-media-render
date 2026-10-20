# Reel content list — APPROVED 2026-10-03

Approved by the user on 2026-10-03 with these changes to the proposal: rows 19 (109:1-6) and 39 (9:128-129) were dropped, and row 17 became 25:58 only. Soft length cap 40 s, hard cap 45 s. The list below (39 Reels, in rotation order) is the single source of truth; the machine-readable copy is `data/reel_list.json`, and the Reel picker (`n8n/pick_reel.js`) walks it in this order.

Rules applied: texts, translations, surah names and audio timings come from the Quran.com API only. Each Reel is one complete short surah or a short run of consecutive ayahs from the approved themes. No sectarian or disputed content and nothing harsh in tone. The order has no surah twice in a row, no reciter or background twice in a row, and no theme three times in a row. Reciters are the approved display names from `data/reciters.json` (Arabic + English are shown on every Reel); backgrounds rotate through gradient / stars / rays / mist / lattice.

**Picker rule (approved 2026-10-03):** a Reel never uses the same ayah or surah as that day's Daily Post. If the next Reel in the list shares the surah of the day's Daily Post, it is skipped for that day and used on a later day (see `n8n/pick_reel.js`; tested over 160 days).

Themes "Faith" and "Unity" (96:1-5, 112:1-4, 49:13) have only DRAFT reflection lines so far (`data/reflections.json`, section "draft"), waiting for the user's approval.

| # | Ref | Surah | Theme | Ayahs | First ayah (Arabic) | Reciter (ID, English, Arabic) | Audio (s) | Background |
|---|---|---|---|---|---|---|---|---|
| 1 | 14:40-41 | Ibrahim | Dua | 2 | رَبِّ ٱجْعَلْنِى مُقِيمَ ٱلصَّلَوٰةِ وَمِن ذُرِّيَّتِى ۚ رَبَّنَا وَتَقَبَّلْ دُعَآءِ | 9 Mohamed Siddiq Al-Minshawi (محمد صديق المنشاوي) | 23.7 | gradient |
| 2 | 11:123 | Hud | Trust | 1 | وَلِلَّهِ غَيْبُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضِ وَإِلَيْهِ يُرْجَعُ ٱلْأَمْرُ كُلُّهُۥ فَٱعْبُدْهُ وَتَوَكَّلْ عَلَيْهِ ۚ وَمَا رَبُّكَ بِغَـٰفِلٍ عَمَّا تَعْمَلُونَ | 7 Mishary Alafasy (مشاري راشد العفاسي) | 24.0 | rays |
| 3 | 3:8-9 | Ali 'Imran | Dua | 2 | رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ ٱلْوَهَّابُ | 10 Saud Ash-Shuraim (سعود الشريم) | 19.2 | lattice |
| 4 | 113:1-5 | Al-Falaq | Trust | 5 | قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 36.8 | stars |
| 5 | 114:1-6 | An-Nas | Trust | 6 | قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ | 3 Abdur-Rahman As-Sudais (عبدالرحمن السديس) | 26.2 | mist |
| 6 | 31:12 | Luqman | Gratitude | 1 | وَلَقَدْ ءَاتَيْنَا لُقْمَـٰنَ ٱلْحِكْمَةَ أَنِ ٱشْكُرْ لِلَّهِ ۚ وَمَن يَشْكُرْ فَإِنَّمَا يَشْكُرُ لِنَفْسِهِۦ ۖ وَمَن كَفَرَ فَإِنَّ ٱللَّهَ غَنِىٌّ حَمِيدٌ | 97 Yasser Al-Dosari (ياسر الدوسري) | 19.5 | stars |
| 7 | 103:1-3 | Al-'Asr | Patience | 3 | وَٱلْعَصْرِ | 2 Abdul Basit Abdus-Samad (عبد الباسط عبد الصمد) | 18.6 | mist |
| 8 | 3:200 | Ali 'Imran | Patience | 1 | يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱصْبِرُوا۟ وَصَابِرُوا۟ وَرَابِطُوا۟ وَٱتَّقُوا۟ ٱللَّهَ لَعَلَّكُمْ تُفْلِحُونَ | 5 Hani Ar-Rifai (هاني الرفاعي) | 15.8 | gradient |
| 9 | 49:13 | Al-Hujurat | Unity | 1 | يَـٰٓأَيُّهَا ٱلنَّاسُ إِنَّا خَلَقْنَـٰكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَـٰكُمْ شُعُوبًا وَقَبَآئِلَ لِتَعَارَفُوٓا۟ ۚ إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ ۚ إِنَّ ٱللَّهَ عَلِيمٌ خَبِيرٌ | 4 Abu Bakr Al-Shatri (أبو بكر الشاطري) | 27.6 | rays |
| 10 | 16:127-128 | An-Nahl | Patience | 2 | وَٱصْبِرْ وَمَا صَبْرُكَ إِلَّا بِٱللَّهِ ۚ وَلَا تَحْزَنْ عَلَيْهِمْ وَلَا تَكُ فِى ضَيْقٍ مِّمَّا يَمْكُرُونَ | 9 Mohamed Siddiq Al-Minshawi (محمد صديق المنشاوي) | 22.1 | lattice |
| 11 | 20:25-28 | Taha | Dua | 4 | قَالَ رَبِّ ٱشْرَحْ لِى صَدْرِى | 7 Mishary Alafasy (مشاري راشد العفاسي) | 15.5 | rays |
| 12 | 106:1-4 | Quraysh | Gratitude | 4 | لِإِيلَـٰفِ قُرَيْشٍ | 4 Abu Bakr Al-Shatri (أبو بكر الشاطري) | 19.8 | lattice |
| 13 | 17:24 | Al-Isra | Family & parents | 1 | وَٱخْفِضْ لَهُمَا جَنَاحَ ٱلذُّلِّ مِنَ ٱلرَّحْمَةِ وَقُل رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا | 3 Abdur-Rahman As-Sudais (عبدالرحمن السديس) | 16.1 | stars |
| 14 | 18:10-12 | Al-Kahf | Dua | 3 | إِذْ أَوَى ٱلْفِتْيَةُ إِلَى ٱلْكَهْفِ فَقَالُوا۟ رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا | 97 Yasser Al-Dosari (ياسر الدوسري) | 38.4 | mist |
| 15 | 93:6-11 | Ad-Duhaa | Mercy | 6 | أَلَمْ يَجِدْكَ يَتِيمًا فَـَٔاوَىٰ | 5 Hani Ar-Rifai (هاني الرفاعي) | 27.2 | gradient |
| 16 | 2:186 | Al-Baqarah | Dua | 1 | وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا۟ لِى وَلْيُؤْمِنُوا۟ بِى لَعَلَّهُمْ يَرْشُدُونَ | 2 Abdul Basit Abdus-Samad (عبد الباسط عبد الصمد) | 18.7 | mist |
| 17 | 25:58 | Al-Furqan | Trust | 1 | وَتَوَكَّلْ عَلَى ٱلْحَىِّ ٱلَّذِى لَا يَمُوتُ وَسَبِّحْ بِحَمْدِهِۦ ۚ وَكَفَىٰ بِهِۦ بِذُنُوبِ عِبَادِهِۦ خَبِيرًا | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 21.1 | gradient |
| 18 | 40:8-9 | Ghafir | Family & parents | 2 | رَبَّنَا وَأَدْخِلْهُمْ جَنَّـٰتِ عَدْنٍ ٱلَّتِى وَعَدتَّهُمْ وَمَن صَلَحَ مِنْ ءَابَآئِهِمْ وَأَزْوَٰجِهِمْ وَذُرِّيَّـٰتِهِمْ ۚ إِنَّكَ أَنتَ ٱلْعَزِيزُ ٱلْحَكِيمُ | 3 Abdur-Rahman As-Sudais (عبدالرحمن السديس) | 25.4 | rays |
| 19 | 94:1-8 | Ash-Sharh | Patience | 8 | أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ | 7 Mishary Alafasy (مشاري راشد العفاسي) | 34.1 | stars |
| 20 | 14:7-8 | Ibrahim | Gratitude | 2 | وَإِذْ تَأَذَّنَ رَبُّكُمْ لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ ۖ وَلَئِن كَفَرْتُمْ إِنَّ عَذَابِى لَشَدِيدٌ | 9 Mohamed Siddiq Al-Minshawi (محمد صديق المنشاوي) | 33.3 | lattice |
| 21 | 97:1-5 | Al-Qadr | Gratitude | 5 | إِنَّآ أَنزَلْنَـٰهُ فِى لَيْلَةِ ٱلْقَدْرِ | 2 Abdul Basit Abdus-Samad (عبد الباسط عبد الصمد) | 36.3 | stars |
| 22 | 57:9 | Al-Hadid | Mercy | 1 | هُوَ ٱلَّذِى يُنَزِّلُ عَلَىٰ عَبْدِهِۦٓ ءَايَـٰتٍۭ بَيِّنَـٰتٍ لِّيُخْرِجَكُم مِّنَ ٱلظُّلُمَـٰتِ إِلَى ٱلنُّورِ ۚ وَإِنَّ ٱللَّهَ بِكُمْ لَرَءُوفٌ رَّحِيمٌ | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 32.8 | mist |
| 23 | 31:14 | Luqman | Family & parents | 1 | وَوَصَّيْنَا ٱلْإِنسَـٰنَ بِوَٰلِدَيْهِ حَمَلَتْهُ أُمُّهُۥ وَهْنًا عَلَىٰ وَهْنٍ وَفِصَـٰلُهُۥ فِى عَامَيْنِ أَنِ ٱشْكُرْ لِى وَلِوَٰلِدَيْكَ إِلَىَّ ٱلْمَصِيرُ | 5 Hani Ar-Rifai (هاني الرفاعي) | 21.4 | gradient |
| 24 | 65:3 | At-Talaq | Trust | 1 | وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَـٰلِغُ أَمْرِهِۦ ۚ قَدْ جَعَلَ ٱللَّهُ لِكُلِّ شَىْءٍ قَدْرًا | 4 Abu Bakr Al-Shatri (أبو بكر الشاطري) | 19.5 | rays |
| 25 | 93:1-5 | Ad-Duhaa | Mercy | 5 | وَٱلضُّحَىٰ | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 33.1 | gradient |
| 26 | 59:10 | Al-Hashr | Dua | 1 | وَٱلَّذِينَ جَآءُو مِنۢ بَعْدِهِمْ يَقُولُونَ رَبَّنَا ٱغْفِرْ لَنَا وَلِإِخْوَٰنِنَا ٱلَّذِينَ سَبَقُونَا بِٱلْإِيمَـٰنِ وَلَا تَجْعَلْ فِى قُلُوبِنَا غِلًّا لِّلَّذِينَ ءَامَنُوا۟ رَبَّنَآ إِنَّكَ رَءُوفٌ رَّحِيمٌ | 10 Saud Ash-Shuraim (سعود الشريم) | 18.6 | rays |
| 27 | 18:46 | Al-Kahf | Reminder | 1 | ٱلْمَالُ وَٱلْبَنُونَ زِينَةُ ٱلْحَيَوٰةِ ٱلدُّنْيَا ۖ وَٱلْبَـٰقِيَـٰتُ ٱلصَّـٰلِحَـٰتُ خَيْرٌ عِندَ رَبِّكَ ثَوَابًا وَخَيْرٌ أَمَلًا | 4 Abu Bakr Al-Shatri (أبو بكر الشاطري) | 18.4 | lattice |
| 28 | 39:53 | Az-Zumar | Mercy | 1 | ۞ قُلْ يَـٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا ۚ إِنَّهُۥ هُوَ ٱلْغَفُورُ ٱلرَّحِيمُ | 9 Mohamed Siddiq Al-Minshawi (محمد صديق المنشاوي) | 25.1 | stars |
| 29 | 16:78 | An-Nahl | Gratitude | 1 | وَٱللَّهُ أَخْرَجَكُم مِّنۢ بُطُونِ أُمَّهَـٰتِكُمْ لَا تَعْلَمُونَ شَيْـًٔا وَجَعَلَ لَكُمُ ٱلسَّمْعَ وَٱلْأَبْصَـٰرَ وَٱلْأَفْـِٔدَةَ ۙ لَعَلَّكُمْ تَشْكُرُونَ | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 28.2 | mist |
| 30 | 21:87-88 | Al-Anbya | Dua | 2 | وَذَا ٱلنُّونِ إِذ ذَّهَبَ مُغَـٰضِبًا فَظَنَّ أَن لَّن نَّقْدِرَ عَلَيْهِ فَنَادَىٰ فِى ٱلظُّلُمَـٰتِ أَن لَّآ إِلَـٰهَ إِلَّآ أَنتَ سُبْحَـٰنَكَ إِنِّى كُنتُ مِنَ ٱلظَّـٰلِمِينَ | 10 Saud Ash-Shuraim (سعود الشريم) | 22.5 | stars |
| 31 | 96:1-5 | Al-'Alaq | Faith | 5 | ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ | 97 Yasser Al-Dosari (ياسر الدوسري) | 16.4 | mist |
| 32 | 2:152-153 | Al-Baqarah | Gratitude | 2 | فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ | 5 Hani Ar-Rifai (هاني الرفاعي) | 20.5 | gradient |
| 33 | 110:1-3 | An-Nasr | Gratitude | 3 | إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ | 7 Mishary Alafasy (مشاري راشد العفاسي) | 25.2 | rays |
| 34 | 18:23-24 | Al-Kahf | Trust | 2 | وَلَا تَقُولَنَّ لِشَا۟ىْءٍ إِنِّى فَاعِلٌ ذَٰلِكَ غَدًا | 3 Abdur-Rahman As-Sudais (عبدالرحمن السديس) | 18.8 | lattice |
| 35 | 112:1-4 | Al-Ikhlas | Faith | 4 | قُلْ هُوَ ٱللَّهُ أَحَدٌ | 6 Mahmoud Khalil Al-Husary (محمود خليل الحصري) | 25.2 | rays |
| 36 | 108:1-3 | Al-Kawthar | Gratitude | 3 | إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ | 9 Mohamed Siddiq Al-Minshawi (محمد صديق المنشاوي) | 16.3 | lattice |
| 37 | 39:10 | Az-Zumar | Patience | 1 | قُلْ يَـٰعِبَادِ ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ رَبَّكُمْ ۚ لِلَّذِينَ أَحْسَنُوا۟ فِى هَـٰذِهِ ٱلدُّنْيَا حَسَنَةٌ ۗ وَأَرْضُ ٱللَّهِ وَٰسِعَةٌ ۗ إِنَّمَا يُوَفَّى ٱلصَّـٰبِرُونَ أَجْرَهُم بِغَيْرِ حِسَابٍ | 2 Abdul Basit Abdus-Samad (عبد الباسط عبد الصمد) | 30.8 | stars |
| 38 | 7:55-56 | Al-A'raf | Mercy | 2 | ٱدْعُوا۟ رَبَّكُمْ تَضَرُّعًا وَخُفْيَةً ۚ إِنَّهُۥ لَا يُحِبُّ ٱلْمُعْتَدِينَ | 10 Saud Ash-Shuraim (سعود الشريم) | 18.6 | gradient |
| 39 | 13:28-29 | Ar-Ra'd | Trust | 2 | ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ | 4 Abu Bakr Al-Shatri (أبو بكر الشاطري) | 22.3 | mist |
