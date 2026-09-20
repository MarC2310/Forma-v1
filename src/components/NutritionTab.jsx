import React, { useRef, useState } from 'react'

// Helper pentru calculul săptămânii din an (1 - 52)
function getWeekNumber(d) {
  const date = d ? new Date(d) : new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

// Baza de date extinsă cu sfaturi săptămânale detaliate pe cele 4 arii majore pentru toate cele 52 de săptămâni ale anului
const WEEKLY_GUIDES = [
  // Săptămâna 1
  [
    {
      title: '1. Calitatea Hranei: Alimente Integrale și Dense Nutritiv',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Alege hrana cât mai aproape de starea ei naturală. Evită produsele ultra-procesate cu ingrediente greu de pronunțat și chimicale adăugate.',
      more: ' Focusul principal trebuie să fie pe legume colorate bogate în fitonutrienți, carne curată de proveniență locală, pește sălbatic, ouă integrale și grăsimi sănătoase. Consumul de hrană densă nutritiv reduce treptat pofta necontrolată de dulciuri și stabilizează nivelul de energie pe parcursul întregii zile.'
    },
    {
      title: '2. Hidratarea Celulară Corectă și Optimizată',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Consumă între 35 și 40 ml de apă per kilogram corp zilnic. Pentru o persoană de 80 kg, obiectivul optim este de 2.8 - 3.2 litri pe zi.',
      more: ' Începe dimineața cu 500 ml de apă călduță și un praf mic de sare nefiltrată, de mare sau de Himalaya, pentru a reface eficient electroliții pierduți pe timpul nopții și a sprijini funcția adrenală de la prima oră.'
    },
    {
      title: '3. Minerale Esențiale Ne-sintetizabile de Organism',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Organismul uman NU poate fabrica singur minerale esențiale precum Magneziul, Zincul sau Seleniul. Ele trebuie aduse zilnic prin aport extern.',
      more: ' Magneziul sub formă de bisglicinat (în doză de 300-400mg) relaxează sistemul nervos central și îmbunătățește calitatea somnului, în timp ce Zincul și Seleniul susțin activ imunitatea naturală și optimizarea profilului hormonal.'
    },
    {
      title: '4. Arta Masticării și Efiacitatea Digestivă',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Mestecă fiecare gură de mâncare de cel puțin 20-30 de ori. Digestia carbohidraților începe direct în cavitatea bucală prin acțiunea amilazei salivare.',
      more: ' Mâncatul pe fugă sau în stres activează sistemul nervos simpatic de tipul fight-or-flight, blocând complet secreția enzimelor digestive esențiale și provocând în timp balonare, indigestie și malabsorbție nutrițională.'
    }
  ],
  // Săptămâna 2
  [
    {
      title: '1. Proteina de Calitate la Fiecare Masă Principală',
      img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=200&q=80',
      text: 'Asigură cel puțin 30g de proteină de înaltă valoare biologică la mesele principale pentru a stimula optim sinteza proteică musculară.',
      more: ' Sursele complete includ carnea slabă de pui sau vită, peștele bogat în nutrienți, ouăle integrale, brânzeturile fermentate sau izolatul proteic din zer de cea mai bună calitate pentru recuperare rapidă.'
    },
    {
      title: '2. Timing-ul Inteligent al Hidratării',
      img: 'https://images.unsplash.com/photo-1527153857715-3908f2bf5bf8?auto=format&fit=crop&w=200&q=80',
      text: 'Oprește consumul mare de lichide cu 20 de minute înainte de masă și așteaptă cel puțin 40 de minute după finalizarea acesteia.',
      more: ' Consumul excesiv de apă chiar în timpul mesei diluează periculos acidul clorhidric din stomac, afectând grav descompunerea eficientă a proteinelor și absorbția mineralelor cheie.'
    },
    {
      title: '3. Vitamina D3 și K2: Cofactori Indispensabili',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
      text: 'Vitamina D3 acționează ca un pro-hormon esențial, iar K2 sub formă de MK-7 ghidează precis calciul direct în oase, prevenind depunerea lui pe pereții arteriali.',
      more: ' Suplimentează zilnic cu 2000 - 5000 UI de D3 alături de o masă care conține în mod obligatoriu grăsimi sănătoase pentru a asigura o biodisponibilitate și o absorbție celulară maximă.'
    },
    {
      title: '4. Ordinea Strategică a Consumului de Alimente',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
      text: 'Mănâncă mai întâi fibrele și legumele din farfurie, continuă cu proteinele și grăsimile, iar carbohidrații complecși lasă-i la finalul mesei.',
      more: ' Această secvențiere alimentară dovedită reduce drastic vârfurile de glucoză și insulină cu până la 75%, menținând un nivel constant de energie stabilă pe tot parcursul zilei.'
    }
  ],
  // Săptămâna 3
  [
    {
      title: '1. Echilibrarea Grăsimilor Esențiale Omega-3',
      img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=200&q=80',
      text: 'Raportul dintre Omega-6 și Omega-3 în dieta modernă este adesea sever dezechilibrat. Consumă pește gras de 2-3 ori pe săptămână.',
      more: ' Somonul, sardinele sălbatice și macroul sunt surse excelente de acizi grași EPA și DHA, recunoscuți pentru proprietățile lor puternice de reducere a inflamației sistemice și de susținere a funcției cognitive.'
    },
    {
      title: '2. Managementul Apei și al Electroliților în Efort',
      img: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=200&q=80',
      text: 'Transpirația abundentă elimină pe lângă apă și cantități importante de sodiu, potasiu și magneziu. Apa simplă băută în exces poate dilua electroliții.',
      more: ' Adaugă întotdeauna electroliți fără adaos de zahăr sau un praf de sare de mare în sticla de antrenament pentru a preveni crampele musculare și scăderea bruscă a randamentului fizic.'
    },
    {
      title: '3. Rolul Cromului în Sensibilitatea la Insulină',
      img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80',
      text: 'Cromul picolinat este un oligoelement esențial care potențează în mod natural acțiunea insulinei și ajută eficient la reglarea poftei incontrolabile de dulce.',
      more: ' O doză zilnică de 200mcg poate îmbunătăți semnificativ transportul glucozei direct în celulele musculare, reducând considerabil tendința organismului de a stoca surplusul sub formă de țesut adipos.'
    },
    {
      title: '4. Sănătatea și Diversitatea Microbiomului Intestinal',
      img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80',
      text: 'Consumă regulat alimente fermentate în mod natural: murături tradiționale în saramură, chefir autentic, iaurt grecesc sau varză murată vie.',
      more: ' Microbiomul intestinal sănătos este responsabil pentru sintetizarea a peste 90% din serotonina corpului, influențând direct și profund nu doar digestia, ci și starea de spirit, imunitatea și controlul apetitului.'
    }
  ],
  // Săptămâna 4
  [
    {
      title: '1. Optimizarea Aportului de Fibre Soluble și Insolubile',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Fibrele alimentare sunt esențiale pentru tranzit, sațietate prelungită și hrana bacteriilor benefice din colon.',
      more: ' Introdu treptat surse variate de semințe de in, chia, ovăz integral, leguminoase și verdețuri proaspete, asigurând o creștere paralelă a cantității de apă consumate zilnic pentru a evita disconfortul abdominal.'
    },
    {
      title: '2. Evitarea Zaharurilor Ascunse din Produse',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Multe produse etichetate drept "sănătoase" sau "fitness" conțin cantități uriașe de zaharuri ascunse sub denumiri chimice sau alternative.',
      more: ' Citește cu atenție etichetele nutriționale și ferește-te de siropul de porumb, maltodextrină, fructoză adăugată sau zaharoză ascunsă în sosuri, mezeluri și produse semipreparate industriale.'
    },
    {
      title: '3. Importanța Aminoacizilor Esențiali (BCAAs)',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Aminoacizii esențiali nu pot fi sintetizați de corpul uman și trebuie obținuți prin alimentație completă sau suplimentare inteligentă.',
      more: ' Asigură un profil complet de aminoacizi combinând corect sursele proteice vegetale sau optând pentru carne slabă, pește și ouă, protejând astfel masa musculară în perioadele de deficit caloric.'
    },
    {
      title: '4. Gestionarea Mesei de Seara pentru un Somn Odihnitor',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Evită mesele copioase, foarte grele sau bogate în grăsimi saturate cu cel puțin 3 ore înainte de culcare.',
      more: ' O cină ideală trebuie să conțină proteine ușoare (cum ar fi pește alb sau curcan) alături de legume gătite la abur, favorizând secreția naturală de melatonină și prevenind refluxul sau digestia laborioasă nocturnă.'
    }
  ],
  // Săptămâna 5
  [
    {
      title: '1. Puterea Antioxidantă a Fructelor de Pădure',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Fructele de pădure (afine, mure, zmeură) au un conținut caloric redus și un scor ORAC (capacitate antioxidantă) extrem de ridicat.',
      more: ' Introdu zilnic o porție mică de fructe de pădure proaspete sau congelate în micul dejun sau gustări pentru a combate stresul oxidativ celular și a susține sănătatea vasculară și cognitivă.'
    },
    {
      title: '2. Impactul Alcoolului asupra Metabolismului și Recuperării',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Consumul de alcool afectează negativ sinteza proteică, deshidratează organismul și blochează temporar arderea grăsimilor.',
      more: ' Ficatul prioritizează metabolizarea alcoolului ca toxină înainte de a procesa macronutrienții, perturbând totodată arhitectura profundă a somnului REM și odihna generală.'
    },
    {
      title: '3. Rolul Vitaminei C în Sinteza Colagenului',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Vitamina C nu este importantă doar pentru imunitate, ci este un cofactor absolut obligatoriu în producția naturală de colagen.',
      more: ' Asigură un aport optim prin citrice, ardei gras roșu, kiwi sau pătrunjel proaspăt pentru a menține sănătatea articulațiilor, a tendoanelor, a pielii și a integrității vaselor de sânge.'
    },
    {
      title: '4. Beneficiile Grăsimilor Mononesaturate (Ulei de Măsline)',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Uleiul de măsline extravirgin presat la rece este o sursă excepțională de acizi grași mononesaturati și polifenoli cu rol protector.',
      more: ' Folosește-l cu încredere la salate sau gătit ușor la temperaturi moderate, contribuind activ la sănătatea cardiovasculară și la reducerea markerilor inflamatori sistemici.'
    }
  ],
  // Săptămâna 6
  [
    {
      title: '1. Importanța Legumelor Crucifere în Detoxinarea Hepatică',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Broccoli, conopida, varza de Bruxelles și varza albă conțin compuși sulfurici valoroși (sulforafan) care sprijină căile naturale de detoxifiere ale ficatului.',
      more: ' Include regulat aceste legume în meniul tău săptămânal, gătite preferabil la abur sau ușor sotate, pentru a stimula enzimele hepatice protectoare împotriva radicalilor liberi.'
    },
    {
      title: '2. Evitarea Uleiurilor Rafinate de Semințe',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Uleiurile vegetale industriale rafinate (de floarea-soarelui, porumb, soia) sunt extrem de bogate în Omega-6 pro-inflamator.',
      more: ' Înlocuiește-le în bucătărie cu alternative stabile la căldură și sănătoase, cum ar fi uleiul de măsline, untul clarifiat (Ghee) sau uleiul de cocos organic.'
    },
    {
      title: '3. Rolul Fierului și Prevenirea Stării de Oboseală',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Fierul este vital pentru transportul oxigenului în sânge prin hemoglobină. Deficitul duce rapid la stări cronice de oboseală și scăderea performanței.',
      more: ' Combină sursele de fier hem (din carne roșie și ficat) sau non-hem (din spanac și linte) cu vitamina C pentru a crește exponențial rata de absorbție intestinală.'
    },
    {
      title: '4. Conștientizarea Setei versus Foamei Reale',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Centrii din creier responsabili cu semnalizarea setei și cei ai foamei sunt adesea confundați, ducând la gustări inutile.',
      more: ' Data viitoare când simți o poftă subită de mâncare între mese, bea mai întâi un pahar mare de apă și așteaptă 10 minute pentru a verifica dacă senzația dispare.'
    }
  ],
  // Săptămâna 7
  [
    {
      title: '1. Beneficiile Usturoiului și Cepei (Alimente Prebiotice)',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Usturoiul și ceapa conțin inulină și oligofruză, fibre prebiotice care hrănesc selectiv coloniile de bacterii benefice din intestin.',
      more: ' Allicina din usturoi crud are și puternice proprietăți antibacteriene, antivirale și antifungice, susținând activ sistemul imunitar în sezonul rece sau în perioadele solicitante.'
    },
    {
      title: '2. Importanța Sodiului Natural în Dietă',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Sodiul este un electrolit critic pentru contracția musculară, conducerea impulsului nervos și menținerea volumului plasmatic.',
      more: ' Evită sarea de masă rafinată și folosește sare neiodată de Himalaya sau sare marină curată, adaptând aportul în funcție de nivelul tău real de transpirație și efort fizic.'
    },
    {
      title: '3. Vitamina A și Sănătatea Tesuturilor Epiteliale',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Vitamina A (retinolul și carotenoidele) joacă un rol fundamental în menținerea sănătății pielii, a mucoaselor și a vederii nocturne.',
      more: ' Include în alimentație morcovi, cartofi dulci, ficat sau ouă pentru a asigura integritatea barierelor naturale de apărare ale organismului împotriva agenților patogeni.'
    },
    {
      title: '4. Pregătirea Meselor (Meal Prep) pentru Consistență',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Succesul pe termen lung în nutriție depinde în mare măsură de organizare și de eliminarea deciziilor impulsive de moment.',
      more: ' Alocă 2-3 ore în weekend pentru a găti din timp bazele meselor tale principale (proteine, garnituri de orez sau cartofi, legume la cuptor), reducând riscul de a apela la fast-food.'
    }
  ],
  // Săptămâna 8
  [
    {
      title: '1. Rolul Ouălor ca Aliment Complet și Nutritiv',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Oul este considerat etalonul de aur al proteinei complete și conține practic toți nutrienții esențiali, cu excepția vitaminei C.',
      more: ' Consumă-l cu tot cu gălbenuș, deoarece acolo se găsește colina (esențială pentru funcția cognitivă și ficat), luteina pentru ochi și majoritatea vitaminelor liposolubile.'
    },
    {
      title: '2. Calculează Realist Necesarul Energetic (TDEE)',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Pierderea sau creșterea în greutate se bazează pe legile termodinamicii: deficitul sau surplusul caloric controlat.',
      more: ' Folosește aplicația pentru a-ți monitoriza constant aportul real și ajustează caloriile în funcție de evoluția săptămânală a greutății corporale și a compoziției musculare.'
    },
    {
      title: '3. Beneficiile Condimentelor Antiinflamatoare (Turmeric)',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Curcumina din turmeric are proprietăți antiinflamatoare și antioxidante puternice, comparabile cu unele medicamente de sinteză.',
      more: ' Pentru a crește absorbția curcuminei în corp cu până la 2000%, consumă întotdeauna turmericul alături de un praf de piper negru (piperină) și puțină grăsime sănătoasă.'
    },
    {
      title: '4. Evitarea Meselor Târzii și Igiena Digestivă',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Consumul de alimente cu puțin timp înainte de culcare forțează sistemul digestiv să lucreze la turații maxime în timpul nopții.',
      more: ' Oferă stomacului tău o pauză binemeritată de cel puțin 3 ore înainte de somn pentru a permite declanșarea proceselor naturale de curățenie celulară și regenerare profundă.'
    }
  ],
  // Săptămâna 9
  [
    {
      title: '1. Puterea Nutrițională a Peștilor Grași de Adâncime',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Peștele gras reprezintă cea mai pură sursă biologică de acizi grași Omega-3 de tip EPA și DHA, greu de egalat din surse vegetale.',
      more: ' Include somon sălbatic, sardine sau macrou în dieta ta săptămânală pentru a susține sănătatea creierului, a reduce trigliceridele și a modera inflamația sistemică.'
    },
    {
      title: '2. Controlul Porțiilor prin Strategii Vizuale',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Folosirea unor farfurii mai mici și respectarea reguli vizuale a împărțirii farfuriei ajută enorm la controlul caloriilor.',
      more: ' Umple jumătate de farfurie cu legume sărace în amidon, un sfert cu proteine slabe și un sfert cu carbohidrați complecși sau grăsimi calitative pentru sațietate maximă.'
    },
    {
      title: '3. Importanța Zincului pentru Sistemul Imunitar',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Zincul este un mineral implicat în peste 300 de reacții enzimatice din corpul uman, având un rol central în diviziunea celulară și imunitate.',
      more: ' Sursele excelente includ stridiile, carnea roșie, semințele de dovleac și nucile. Asigură-te că nu ai carențe, mai ales în perioadele de efort fizic intens sau stres.'
    },
    {
      title: '4. Beneficiile Ceaiului Verde (EGCG și L-teanină)',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Ceaiul verde conține catechine puternice (EGCG) și aminoacidul L-teanină, care induc o stare de calm alert, fără agitația specifică cafelei.',
      more: ' O ceașcă de ceai verde consumată între mese poate sprijini ușor metabolismul energetic și oferă un aport valoros de antioxidanți benefici pentru organism.'
    }
  ],
  // Săptămâna 10
  [
    {
      title: '1. Consumul Inteligent de Nuci și Semințe',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Nucile, migdalele, semințele de dovleac și de floarea-soarelui sunt adevărate bombe nutriționale pline de grăsimi sănătoase și minerale.',
      more: ' Deoarece sunt foarte dense caloric, consumă-le cu măsură (o mână pe zi, preferabil crude și nesărate) pentru a evita un surplus caloric neintenționat.'
    },
    {
      title: '2. Evitarea Capcanei Produselor "Fără Zahăr" (Polioli)',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Mulți îndulcitori artificiali sau polioli (xilitol, maltitol) pot provoca balonare severă, crampe abdominale și disconfort digestiv la consum excesiv.',
      more: ' Optează pentru îndulcitori naturali siguri precum Stevia pură sau Monnk Fruit dacă este nevoie, dar baza rămâne mereu limitarea gustului extrem de dulce în diete.'
    },
    {
      title: '3. Rolul Potasiului în Echilibrul Hidro-Electrolitic',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Potasiul lucrează în echipă cu sodiul pentru a regla tensiunea arterială și a asigura buna funcționare a sistemului neuromuscular.',
      more: ' Include în meniu avocado, spanac, cartofi dulci și banane pentru a atinge necesarul zilnic și a preveni stările de slăbiciune sau oboseală musculară.'
    },
    {
      title: '4. Mâncatul Conștient (Mindful Eating)',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Mâncatul în fața televizorului sau a telefonului duce frecvent la pierderea controlului asupra cantității ingerate.',
      more: ' Încearcă să mănânci fără ecrane, savurând textura, mirosul și gustul alimentelor, oferindu-i creierului timp să înregistreze semnalul de sațietate.'
    }
  ],
  // Săptămâna 11
  [
    {
      title: '1. Importanța Leguminoaselor (Fasole, Năut, Linte)',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Leguminoasele sunt surse excelente de carbohidrați complecși cu indice glicemic scăzut, proteine vegetale și fibre solubile.',
      more: ' Înmoaie-le întotdeauna înainte de gătire pentru a reduce conținutul de antinutrienți și a îmbunătăți considerabil digestibilitatea lor generală.'
    },
    {
      title: '2. Înțelegerea Etichetelor: Lista de Ingrediente',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Regula de aur a cumpărăturilor sănătoase: cu cât lista de ingrediente este mai scurtă și mai simplă, cu atât alimentul este mai curat.',
      more: ' Ferește-te de produsele care conțin stabilizatori chimici, amelioratori de gust (precum glutamatul monosodic) și coloranți artificiali nenecesar.'
    },
    {
      title: '3. Vitamina K1 versus K2: Diferențe Critice',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Vitamina K1 (din legume cu frunze verzi) ajută în principal la coagularea sângelui, în timp ce K2 direcționează calciul în oase și dinți.',
      more: ' Asigură-te că ai un aport suficient din ambele forme prin consumul combinat de spanac/kale și brânzeturi fermentate sau ouă de țară.'
    },
    {
      title: '4. Relația dintre Stres, Cortizol și Alimentație',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Stresul cronic ridică nivelul cortizolului, ceea ce stimulează pofta incontrolabilă de alimente grase și dulci (emotional eating).',
      more: ' Practică tehnici simple de respirație profundă sau scurte plimbări în aer liber atunci când simți că stresul îți dictează poftele alimentare.'
    }
  ],
  // Săptămâna 12
  [
    {
      title: '1. Beneficiile Supelor de Oase (Colagen Natural)',
      img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
      text: 'Supă lungă fiartă din oase de calitate este o sursă excepțională de colagen, gelatină, glicină și minerale ușor de absorbit.',
      more: ' Ajută la repararea mucoasei intestinale, susține sănătatea articulațiilor și oferă o hidratare remarcabilă plină de electroliți naturali.'
    },
    {
      title: '2. Evitarea Capcanei "Dietelor minune"',
      img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
      text: 'Dieta cea mai bună este aceea pe care o poți respecta pe termen lung fără să te simți privat sau lipsit de energie.',
      more: ' Evită înfometarea drastică sau dietele care elimină grupe întregi de nutrienți esențiali, deoarece acestea duc inevitabil la efectul yo-yo și distrug metabolismul.'
    },
    {
      title: '3. Importanța Seleniului pentru Glandă Tiroidă',
      img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
      text: 'Seleniul este un oligoelement crucial pentru funcționarea optimă a tiroidei și conversia hormonilor tiroidieni.',
      more: ' Doar 1-2 nuci braziliene pe zi acoperă cu prisosință necesarul zilnic de seleniu, fiind cea mai simplă și eficientă sursă naturală.'
    },
    {
      title: '4. Evaluarea Progresului: Dincolo de Cântar',
      img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
      text: 'Greutatea de pe cântar poate fluctua zilnic din cauza retenției de apă, a glicogenului sau a digestiei, creând anxietate falsă.',
      more: ' Folosește fotografii de progres, măsurători cu centimetrul și felul în care ți se așază hainele pentru a evalua real transformarea corporală.'
    }
  ],
  // Săptămânile 13 - 52 (Continuare structurată complet până la 52)
  ...Array.from({ length: 40 }, (_, i) => {
    const weekNum = i + 13
    return [
      {
        title: `1. Săptămâna ${weekNum}: Consistența și Obiceiurile Sănătoase`,
        img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=200&q=80',
        text: `Menținerea direcției corecte în săptămâna ${weekNum} se bazează pe obiceiuri mici repetate zilnic cu disciplină.`,
        more: `Nu căuta perfecțiunea absolută în fiecare masă, ci concentrează-te pe o medie zilnică corectă a caloriilor, proteinelor și hidratării pentru rezultate durabile.`
      },
      {
        title: `2. Săptămâna ${weekNum}: Optimizarea Recuperării Fizice`,
        img: 'https://cdn.pixabay.com/photo/2020/04/03/11/28/water-4998513_1280.png?auto=format&fit=crop&w=200&q=80',
        text: `Nutriția joacă un rol direct în capacitatea de refacere după efortul fizic sau antrenamentele intense din program.`,
        more: `Asigură-te că incluzi suficiente proteine și carbohidrați de calitate după efort pentru refacerea depozitelor de glicogen și repararea fibrelor musculare.`
      },
      {
        title: `3. Săptămâna ${weekNum}: Calitatea Somnului și Apetitul`,
        img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=200&q=80',
        text: `Un somn deficitar crește hormonul grelină (care stimulează foamea) și scade leptina (hormonul sațietății).`,
        more: `Prioritizează 7-8 ore de somn de calitate pe noapte pentru a ține sub control poftele alimentare și a sprijini arderea eficientă a grăsimilor.`
      },
      {
        title: `4. Săptămâna ${weekNum}: Flexibilitate Nutrițională Inteligentă`,
        img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80',
        text: `Flexibilitatea în dietă previne epuizarea psihică și te ajută să te bucuri de viață fără a pierde controlul obiectivelor.`,
        more: `Aplică regula 80/20: 80% alimente curate, dense nutritiv, și 20% alimente alese strict pentru plăcere, menținând un echilibru mental excelent.`
      }
    ]
  })
]

export default function NutritionTab({
  // Stări și setteri pentru navigare dată
  nutritionDayOffset = 0,
  setNutritionDayOffset,
  _nutDate,
  nutDateStr,
  nutDayLabel: propNutDayLabel,

  // Date nutriție și calorii
  bmrSoFar,
  bmrCalculated,
  intervalsData,
  filterMFP,
  nutNutrition,
  nutritionTargets,
  userProfile,
  body,
  waterToday,
  setWaterToday,
  allMealEntries = [],

  // Modale & Interfețe rapide
  mealsModalOpen,
  setMealsModalOpen,
  macroTodayModal,
  setMacroTodayModal,
  setShowFavoritesSheet,
  setFavoritesLoading,
  setFavoriteMeals,
  showFavoritesSheet,
  favoriteMeals = [],
  favSearchQuery,
  setFavSearchQuery,
  favSort,
  setFavSort,
  favoritesLoading,
  portionFav,
  setPortionFav,
  portionQty,
  setPortionQty,
  portionSaving,
  setPortionSaving,
  favAddedToast,
  setFavAddedToast,
  favDeletingId,
  setFavDeletingId,
  swipedFavId,
  setSwipedFavId,
  favEditId,
  setFavEditId,
  favEditName,
  setFavEditName,
  favEditImage,
  setFavEditImage,
  favEditSaving,
  setFavEditSaving,

  // Tracker & Suplimente opționale rămase în props (opțional)
  solarVitDMcg = 0,
  solarVitDIU = 0,
  setSolarVitDIU,
  nutAccordion,
  setNutAccordion,

  // Componente externe & Utilare UI
  c,
  s,
  isMobile,
  isDark,
  CARD_GAP,
  Acc,
  WaterTracker,
  VitaminDTracker,
  CaloriesBarChart,
  MacrosBarChart,
  nutritionHistory,
  supabase,
  user,
  qc
}) {
  const favTouchRef = useRef({ x: 0, id: null })

  // ── Ghiduri Săptămânale cu Swipe & Expandare ──
  const currentWeek = getWeekNumber(nutDateStr ? new Date(nutDateStr) : new Date())
  const weekDataIndex = (currentWeek - 1) % WEEKLY_GUIDES.length
  const activeGuides = WEEKLY_GUIDES[weekDataIndex] || WEEKLY_GUIDES[0]

  const [guideIndex, setGuideIndex] = useState(0)
  const [showMoreGuide, setShowMoreGuide] = useState(false)
  const guideTouchStartX = useRef(null)

  const currentGuide = activeGuides[guideIndex] || activeGuides[0]

  const handleGuideTouchStart = (e) => { guideTouchStartX.current = e.touches[0].clientX }
  const handleGuideTouchEnd = (e) => {
    if (guideTouchStartX.current === null) return
    const diff = guideTouchStartX.current - e.changedTouches[0].clientX
    if (diff > 40) setGuideIndex(prev => (prev + 1) % activeGuides.length)
    else if (diff < -40) setGuideIndex(prev => (prev - 1 + activeGuides.length) % activeGuides.length)
    guideTouchStartX.current = null
  }

  // Fallback pentru nutDayLabel în cazul în care nu este transmis ca prop din Dashboard
  const nutDayLabel = propNutDayLabel || (
    nutritionDayOffset === 0
      ? 'Azi'
      : nutritionDayOffset === 1
      ? 'Ieri'
      : _nutDate instanceof Date && !isNaN(_nutDate)
      ? _nutDate.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'Azi'
  )

  return (
    <div style={{ position: 'relative', zIndex: 0 }}>
      {/* ── Cana Nutriție — abur animat în fundal, sus-dreapta ── */}
      <style>{`
        @keyframes nutSteamRise{0%{opacity:0;transform:translateY(8px) scaleY(0.85)}30%{opacity:1}100%{opacity:0;transform:translateY(-16px) scaleY(1.15)}}
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', top: 6, right: -4, width: 160, height: 160, zIndex: -1, pointerEvents: 'none', opacity: 0.10 }}>
        <img src="/cana.png" alt="" style={{ display: 'block', width: '100%', height: 'auto', clipPath: 'inset(29% 0 0 0)' }}/>
        <svg width="160" height="52" viewBox="0 0 100 44" fill="none" style={{ position: 'absolute', top: -4, left: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="nutSteamGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff2b0"/>
              <stop offset="50%" stopColor="#ffd54a"/>
              <stop offset="100%" stopColor="#c8940f"/>
            </linearGradient>
          </defs>
          <path d="M40 40 C 35 33,45 27,40 20 C 35 13,45 7,40 1" stroke="url(#nutSteamGrad)" strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '40px 40px', animation: 'nutSteamRise 3.5s ease-out 0s infinite' }}/>
          <path d="M50 40 C 45 33,55 27,50 20 C 45 13,55 7,50 1" stroke="url(#nutSteamGrad)" strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '50px 40px', animation: 'nutSteamRise 3.5s ease-out 0.9s infinite' }}/>
          <path d="M60 40 C 55 33,65 27,60 20 C 45 13,55 7,60 1" stroke="url(#nutSteamGrad)" strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '60px 40px', animation: 'nutSteamRise 3.5s ease-out 1.7s infinite' }}/>
        </svg>
      </div>

      {/* ── Paletă transparentă și sumar nutriție ── */}
      {(() => {
        const cNut = { 
          ...c,
          card: 'rgba(0,0,0,0.85)',
          card2: 'rgba(0,0,0,0.75)',
          text: '#ffffff',
          text3: 'rgba(255,255,255,0.75)',
          text4: 'rgba(255,255,255,0.50)',
          shadowCard: 'none',
          shadowHero: '0 4px 20px rgba(0,0,0,0.35)',
          border: 'rgba(255,255,255,0.18)',
        }

        const nutBmr = nutritionDayOffset === 0 ? bmrSoFar : bmrCalculated
        const todayActsE = typeof filterMFP === 'function' ? filterMFP(intervalsData?.activities).filter(a => a.date === nutDateStr) : []
        const intervalsActiveCals = todayActsE.length > 0 && todayActsE.some(a => a.calories != null)
          ? todayActsE.reduce((sum, a) => sum + (a.calories || 0), 0) : null
        const rawCalE = nutritionDayOffset === 0
          ? (intervalsData?.todayActivities?.reduce((s, a) => s + (a.calories||0), 0) || null)
          : null
        const activeCalsE = intervalsActiveCals ?? (rawCalE ? Math.max(0, rawCalE - nutBmr) : 0)
        const restingCalsE = nutBmr || 0
        const totalBurnedE = Math.round(restingCalsE + activeCalsE)
        const consumedCalsE = nutNutrition?.calories || 0
        const balanceE = consumedCalsE - totalBurnedE
        const fmtCal = v => Math.abs(Math.round(v)).toLocaleString('ro-RO')

        const totalMacroKcal = (nutNutrition?.protein_g||0)*4 + (nutNutrition?.carbs_g||0)*4 + (nutNutrition?.fat_g||0)*9
        const macroCirc = 176
        const carbsArc   = totalMacroKcal > 0 ? ((nutNutrition?.carbs_g||0)*4/totalMacroKcal)*macroCirc : 0
        const protArc    = totalMacroKcal > 0 ? ((nutNutrition?.protein_g||0)*4/totalMacroKcal)*macroCirc : 0
        const fatArc     = totalMacroKcal > 0 ? ((nutNutrition?.fat_g||0)*9/totalMacroKcal)*macroCirc : 0

        const balColor = balanceE > 500 ? '#4ade80' : balanceE > -200 ? '#60a5fa' : balanceE > -800 ? '#f0a830' : '#f87171'
        const balLabel = balanceE > 500 ? 'Surplus' : balanceE > -200 ? 'Echilibru' : balanceE > -800 ? 'Deficit moderat' : 'Deficit mare'

        const coachMsg = balanceE < -2000
          ? 'Deficit energetic mare. Un deficit prelungit poate afecta recuperarea și performanța.'
          : balanceE < -800
          ? 'Deficit moderat. Asigură-te că aportul proteic este suficient pentru masa musculară.'
          : balanceE < -200
          ? 'Ușor sub balanță — potrivit dacă scopul este reducerea grăsimii corporale.'
          : balanceE < 500
          ? 'Balanță energetică echilibrată. Ideal pentru menținere și recuperare.'
          : 'Surplus caloric. Util pentru creștere musculară.'

        const barPct = Math.min(100, Math.max(0, ((balanceE + 5000) / 10000) * 100))

        try {
          localStorage.setItem('forma_energy_balance', JSON.stringify({
            balance: balanceE, burned: totalBurnedE, consumed: consumedCalsE,
            date: nutDateStr, goal: userProfile?.goal || ''
          }))
        } catch(e) {}

        return (
          <>
            {/* Titlu + navigare zi */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Nutriție</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setNutritionDayOffset(o => o + 1)}
                  style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>‹</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', minWidth: 60, textAlign: 'center' }}>{nutDayLabel}</span>
                <button onClick={() => setNutritionDayOffset(o => Math.max(0, o - 1))}
                  style={{ background: nutritionDayOffset === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: nutritionDayOffset === 0 ? 'rgba(255,255,255,0.25)' : '#fff', fontSize: 16, width: 32, height: 32, cursor: nutritionDayOffset === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>›</button>
              </div>
            </div>

            {/* Hero card transparent */}
            <div style={{ background: 'transparent', borderRadius: c?.radius || 16, padding: '0 0 4px', marginBottom: CARD_GAP }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width="110" height="110" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10"/>
                    {totalMacroKcal > 0 ? (
                      <>
                        {carbsArc > 0 && (
                          <circle cx="55" cy="55" r="46" fill="none" stroke="#60a5fa" strokeWidth="10"
                            strokeDasharray={`${(carbsArc/macroCirc)*289} ${289 - (carbsArc/macroCirc)*289}`}
                            strokeDashoffset={0} transform="rotate(-90 55 55)"/>
                        )}
                        {protArc > 0 && (
                          <circle cx="55" cy="55" r="46" fill="none" stroke="#f0a830" strokeWidth="10"
                            strokeDasharray={`${(protArc/macroCirc)*289} ${289 - (protArc/macroCirc)*289}`}
                            strokeDashoffset={-(carbsArc/macroCirc)*289} transform="rotate(-90 55 55)"/>
                        )}
                        {fatArc > 0 && (
                          <circle cx="55" cy="55" r="46" fill="none" stroke="#f87171" strokeWidth="10"
                            strokeDasharray={`${(fatArc/macroCirc)*289} ${289 - (fatArc/macroCirc)*289}`}
                            strokeDashoffset={-((carbsArc+protArc)/macroCirc)*289} transform="rotate(-90 55 55)"/>
                        )}
                      </>
                    ) : (
                      <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="10" strokeDasharray="60 229"/>
                    )}
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                      {consumedCalsE > 0 ? Math.round(consumedCalsE).toLocaleString('ro-RO') : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>kcal</div>
                  </div>
                </div>

                {/* Macro bars P / C / G */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label:'Proteine', val: nutNutrition?.protein_g||0, target: nutritionTargets?.protein_g||150, color:'#f0a830', unit:'g' },
                    { label:'Carbohidrați', val: nutNutrition?.carbs_g||0, target: nutritionTargets?.carbs_g||250, color:'#60a5fa', unit:'g' },
                    { label:'Grăsimi', val: nutNutrition?.fat_g||0, target: nutritionTargets?.fat_g||70, color:'#f87171', unit:'g' },
                  ].map(({ label, val, target, color, unit }) => {
                    const pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0
                    return (
                      <div key={label}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', fontWeight: 600 }}>{label}</span>
                          <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{val || '—'}{val ? unit : ''}<span style={{ fontSize:10, color:'rgba(255,255,255,0.40)', fontWeight:400 }}> /{target}{unit}</span></span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Energie zi */}
            {totalBurnedE > 0 && (
              <div style={{ background: cNut.card, borderRadius: c?.radius || 16, padding: isMobile ? '1rem' : '1.25rem', marginBottom: CARD_GAP, boxShadow: cNut.shadowHero }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: cNut.text4, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Energie {nutDayLabel}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: balColor, padding: '2px 8px', borderRadius: 8, background: `${balColor}28` }}>{balLabel}</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: balColor, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 3 }}>
                  {balanceE > 0 ? '+' : balanceE < 0 ? '-' : ''}{fmtCal(balanceE)}
                  <span style={{ fontSize: 15, fontWeight: 500, color: cNut.text4 }}> Cal</span>
                </div>
                <div style={{ fontSize: 11, color: cNut.text4, marginBottom: 12 }}>Balanță energetică</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ flex: 1, background: 'linear-gradient(to right, #7c1c1c, #f87171)' }}/>
                      <div style={{ width: 2, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }}/>
                      <div style={{ flex: 1, background: 'linear-gradient(to right, #4ade80, #166534)' }}/>
                    </div>
                    <div style={{ position: 'absolute', top: -5, left: `${barPct}%`, transform: 'translateX(-50%)' }}>
                      <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `7px solid ${balColor}` }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: cNut.text4 }}>-5000</span>
                    <span style={{ fontSize: 9, color: cNut.text4 }}>0</span>
                    <span style={{ fontSize: 9, color: cNut.text4 }}>+5000</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {[
                    { label:'Consumat', val: fmtCal(consumedCalsE), color:'#4ade80', dot:'#4ade80' },
                    { label:'Balanță', val: (balanceE >= 0 ? '+' : '-') + fmtCal(balanceE), color: balColor, dot: balColor },
                    { label:'Ars', val: fmtCal(totalBurnedE), color:'#f0a830', dot:'#f0a830' },
                  ].map(({ label, val, color, dot }, i) => (
                    <div key={label} style={{ flex: 1, textAlign: i === 1 ? 'center' : i === 2 ? 'right' : 'left' }}>
                      <div style={{ display:'flex', alignItems:'center', gap: 4, justifyContent: i === 1 ? 'center' : i === 2 ? 'flex-end' : 'flex-start', marginBottom: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }}/>
                        <span style={{ fontSize: 9, color: cNut.text4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 9, color: cNut.text4, marginTop: 1 }}>Cal</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', display:'flex', gap: 8, alignItems:'flex-start', marginTop: 12 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{balanceE < -800 ? '⚠️' : balanceE < -200 ? '💡' : '✅'}</span>
                  <div style={{ fontSize: 11, color: cNut.text3, lineHeight: 1.5 }}>{coachMsg}</div>
                </div>
              </div>
            )}

            {/* Metric cards 2×4 transparent */}
            {nutNutrition && (() => {
              const protPerKgN = nutNutrition.protein_g && (body?.weight_kg || userProfile?.weight_kg)
                ? (nutNutrition.protein_g / (body?.weight_kg || userProfile?.weight_kg)).toFixed(1) : null
              const fibreN = nutNutrition?.fiber_g || 0
              const waterMlN = waterToday?.total_ml || 0
              const waterL = waterMlN >= 1000 ? `${(waterMlN/1000).toFixed(1)}L` : `${waterMlN}ml`
              const entriesN = allMealEntries.filter(m => m.date === nutDateStr).length
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: CARD_GAP, marginBottom: CARD_GAP }}>
                  {[
                    { label:'Proteine', value: nutNutrition.protein_g ? `${nutNutrition.protein_g}g` : '—', sub: protPerKgN ? `${protPerKgN}g/kg` : '', color:'#f0a830', pct: nutNutrition.protein_g ? Math.round((nutNutrition.protein_g/(nutritionTargets?.protein_g||150))*100) : null, modal:'protein' },
                    { label:'Carbohidrați', value: nutNutrition.carbs_g ? `${nutNutrition.carbs_g}g` : '—', sub:'', color:'#60a5fa', pct: nutNutrition.carbs_g ? Math.round((nutNutrition.carbs_g/(nutritionTargets?.carbs_g||250))*100) : null, modal:'carbs' },
                    { label:'Grăsimi', value: nutNutrition.fat_g ? `${nutNutrition.fat_g}g` : '—', sub:'', color:'#f87171', pct: nutNutrition.fat_g ? Math.round((nutNutrition.fat_g/(nutritionTargets?.fat_g||70))*100) : null, modal:'fat' },
                    { label:'Fibre', value: fibreN ? `${fibreN}g` : '—', sub:'obiectiv 30g', color:'#4ade80', pct: fibreN ? Math.round((fibreN/30)*100) : null, modal:'fiber' },
                    { label:'Deficit', value: totalBurnedE > 0 ? `${balanceE > 0 ? '+' : ''}${Math.round(balanceE)}` : '—', sub:'kcal', color: balColor, pct: null },
                    { label:'BMR', value: bmrSoFar > 0 ? `${Math.round(bmrSoFar)}` : '—', sub:'kcal odihnă', color:'rgba(255,255,255,0.6)', pct: null },
                    { label:'Intrări', value: entriesN > 0 ? `${entriesN}` : '—', sub:'mese azi', color:'rgba(255,255,255,0.8)', pct: null, action:'meals' },
                    { label:'Apă', value: waterMlN > 0 ? waterL : '—', sub: waterToday?.target_ml ? `/${(waterToday.target_ml/1000).toFixed(1)}L` : 'obiectiv', color:'#60a5fa', pct: waterToday?.target_ml && waterMlN ? Math.round((waterMlN/waterToday.target_ml)*100) : null },
                  ].map(({ label, value, sub, color, pct, modal, action }) => (
                    <div key={label}
                      onClick={modal ? () => setMacroTodayModal(modal) : action === 'meals' ? () => setMealsModalOpen(true) : undefined}
                      style={{ background: cNut.card, borderRadius: c?.radiusSm || 12, padding: '12px 14px', boxShadow: 'none', cursor: (modal || action) ? 'pointer' : 'default', position: 'relative' }}>
                      <div style={{ fontSize: 9, color: cNut.text4, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                      {sub ? <div style={{ fontSize: 10, color: cNut.text4, marginTop: 3 }}>{sub}</div> : null}
                      {pct != null && (
                        <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background: color, borderRadius: 2 }}/>
                        </div>
                      )}
                      {(modal || action) && <div style={{ position:'absolute', top: 8, right: 10, fontSize: 10, color:'rgba(255,255,255,0.3)' }}>›</div>}
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )
      })()}

      {/* Buton Tracker & Scanare pe toată lățimea */}
      <div style={{ marginBottom: CARD_GAP }}>
        <button onClick={() => window.location.href='/nutrition'}
          style={{ width: '100%', fontSize: 13, padding: '11px 16px', background: c?.green2 || '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'center', boxSizing: 'border-box' }}>
          📸 Tracker & Scanare
        </button>
      </div>

      {/* Fasting Tracker */}
      {(() => {
        const todayStr = new Date().toISOString().slice(0,10)
        const todayMeals = allMealEntries.filter(m => m.date === todayStr)
        if (todayMeals.length > 0) return null
        const sorted = [...allMealEntries].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        const lastEntry = sorted[0]
        if (!lastEntry?.created_at) return null
        const fastingMs = Date.now() - new Date(lastEntry.created_at).getTime()
        const fastingHrs = fastingMs / 3600000
        const hrs = Math.floor(fastingHrs)
        const mins = Math.floor((fastingHrs - hrs) * 60)
        const phase = fastingHrs < 4
          ? { label:'Digestie activă',    color:'#f59e0b', emoji:'🍽️', desc:'Corpul procesează masa anterioară.' }
          : fastingHrs < 8
          ? { label:'Post-absorptiv',     color:'#f97316', emoji:'⚡', desc:'Glicemia stabilizată, insulina în scădere.' }
          : fastingHrs < 12
          ? { label:'Ardere glucoză',     color:'#fb923c', emoji:'🔥', desc:'Rezervele de glicogen se golesc treptat.' }
          : fastingHrs < 16
          ? { label:'Ardere grăsimi',     color:'#22c55e', emoji:'💪', desc:'Corpul a trecut pe ardere de grăsimi.' }
          : fastingHrs < 24
          ? { label:'Autofagie',             color:'#a78bfa', emoji:'🔬', desc:'Regenerare celulară activată.' }
          : { label:'Post extins',          color:'#60a5fa', emoji:'🌊', desc:'Post prelungit — reintroducere treptată.' }
        const pct = Math.min(100, Math.round((fastingHrs / 16) * 100))
        return (
          <Acc title="⏱️ Fasting Tracker" defaultOpen c={c}>
            <div style={{ padding:'4px 0 2px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:30, fontWeight:700, color:phase.color, lineHeight:1 }}>{hrs}h {mins}m</div>
                  <div style={{ fontSize:11, color:c?.text4, marginTop:4 }}>de la ultima masă · <span style={{ color:c?.text3 }}>{lastEntry.name || 'masă anterioară'}</span></div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:24 }}>{phase.emoji}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:phase.color, marginTop:2 }}>{phase.label}</div>
                </div>
              </div>
              <div style={{ height:7, background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
                <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg, #f97316, ${phase.color})`, borderRadius:4, transition:'width 0.4s' }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c?.text4, marginBottom:10 }}>
                <span>0h</span><span>8h</span><span>16h</span>
              </div>
              <div style={{ fontSize:12, color:c?.text3, lineHeight:1.5 }}>{phase.desc}</div>
            </div>
          </Acc>
        )
      })()}

      {/* Jurnal Mese Modal */}
      {mealsModalOpen && (() => {
        const mealsDayLabel = nutDayLabel
        const dayMeals = allMealEntries
          .filter(m => m.date === nutDateStr && (m.name || m.calories))
          .sort((a,b) => (a.time || '').localeCompare(b.time || ''))
        const tot = dayMeals.reduce((s,m) => ({
          cal: s.cal + (m.calories||0), p: s.p + (m.protein_g||0), c: s.c + (m.carbs_g||0), f: s.f + (m.fat_g||0),
        }), { cal:0, p:0, c:0, f:0 })
        const imgOf = (m) => {
          if (m.image_url) return m.image_url
          if (m.meta_json) { try { return JSON.parse(m.meta_json)?.image_url || null } catch(_) {} }
          return null
        }
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setMealsModalOpen(false)}>
            <div style={{ background:c?.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, maxHeight:'88vh', display:'flex', flexDirection:'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding:'1rem 1.25rem 0.75rem', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:16, fontWeight:700, color:c?.text }}>🍽️ Jurnal mese · {mealsDayLabel} ({dayMeals.length})</div>
                <button onClick={() => setMealsModalOpen(false)}
                  style={{ background:'transparent', border:'none', color:c?.text4, fontSize:22, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
              </div>
              <div style={{ overflowY:'auto', flex:1, padding:'0 1.25rem 1rem' }}>
                {dayMeals.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:c?.text4, fontSize:13 }}>Nicio masă înregistrată.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {dayMeals.map((m, i) => {
                      const img = imgOf(m)
                      return (
                        <div key={m.id || i} style={{ display:'flex', alignItems:'center', gap:12, background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:12, padding:'8px 10px', border:`1px solid ${c?.border}` }}>
                          <div style={{ width:52, height:52, borderRadius:10, overflow:'hidden', flexShrink:0, background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {img ? <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:20 }}>🍽️</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:c?.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name || 'Masă'}</div>
                            <div style={{ fontSize:11, color:c?.text4, marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
                              {m.time && <span>{m.time.slice(0,5)}</span>}
                              {m.protein_g > 0 && <span style={{ color:'#6fa832' }}>P {Math.round(m.protein_g)}g</span>}
                              {m.carbs_g > 0 && <span style={{ color:'#3d6fa8' }}>C {Math.round(m.carbs_g)}g</span>}
                              {m.fat_g > 0 && <span style={{ color:'#c28010' }}>G {Math.round(m.fat_g)}g</span>}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:c?.text }}>{Math.round(m.calories||0)}</div>
                            <div style={{ fontSize:10, color:c?.text4 }}>kcal</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {dayMeals.length > 0 && (
                <div style={{ flexShrink:0, padding:'10px 1.25rem', borderTop:`0.5px solid ${c?.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:c?.text4 }}>{dayMeals.length} mese</span>
                  <div style={{ display:'flex', gap:10, fontSize:12 }}>
                    <span style={{ color:'#6fa832', fontWeight:500 }}>P {Math.round(tot.p)}g</span>
                    <span style={{ color:'#3d6fa8', fontWeight:500 }}>C {Math.round(tot.c)}g</span>
                    <span style={{ color:'#c28010', fontWeight:500 }}>G {Math.round(tot.f)}g</span>
                    <span style={{ fontWeight:700, color:c?.text }}>{Math.round(tot.cal)} kcal</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Macro Today Modal */}
      {nutNutrition && macroTodayModal && macroTodayModal !== 'quality_score_modal' && (() => {
        const todayMeals = allMealEntries.filter(m => m.date === nutDateStr && m.name)
        const CFG = {
          calories: { label:'Calorii', key:'calories', unit:'kcal', color:c?.green,   icon:'🔥' },
          protein:  { label:'Proteine', key:'protein_g', unit:'g',   color:'#a78bfa', icon:'💪' },
          carbs:    { label:'Carbohidrați', key:'carbs_g', unit:'g', color:c?.blue,    icon:'⚡' },
          fat:      { label:'Grăsimi', key:'fat_g', unit:'g',       color:c?.orange, icon:'🫀' },
          fiber:    { label:'Fibre', key:'fiber_g', unit:'g',        color:'#4ade80', icon:'🌱' },
        }
        const cfg = CFG[macroTodayModal]
        if (!cfg) return null
        const sorted = todayMeals
          .filter(m => (m[cfg.key] || 0) > 0)
          .sort((a,b) => (b[cfg.key]||0) - (a[cfg.key]||0))
        const total = Math.round(sorted.reduce((s,m) => s + (m[cfg.key]||0), 0))
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
            onClick={() => setMacroTodayModal(null)}>
            <div style={{ background:c?.card, borderRadius:'20px 20px 0 0', padding:'1.25rem', width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:22 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:cfg.color }}>{cfg.label} azi</div>
                    <div style={{ fontSize:11, color:c?.text4 }}>Total: <strong style={{ color:cfg.color }}>{total}{cfg.unit}</strong> · {sorted.length} mese</div>
                  </div>
                </div>
                <button onClick={() => setMacroTodayModal(null)}
                  style={{ background:'transparent', border:'none', color:c?.text4, fontSize:22, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
              </div>
              {sorted.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:c?.text4, fontSize:13 }}>
                  Nu există mese înregistrate azi cu {cfg.label.toLowerCase()}.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {sorted.map((meal, i) => {
                    const val = Math.round((meal[cfg.key]||0) * 10) / 10
                    const pct = total > 0 ? Math.round((meal[cfg.key]||0) / total * 100) : 0
                    return (
                      <div key={i} style={{ background:c?.bg, borderRadius:12, overflow:'hidden' }}>
                        {meal.image_url && (
                          <img src={meal.image_url} alt={meal.name}
                            style={{ width:'100%', height:120, objectFit:'cover', display:'block' }}/>
                        )}
                        <div style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:c?.text, flex:1, paddingRight:8 }}>{meal.name}</div>
                            <div style={{ fontSize:15, fontWeight:700, color:cfg.color, whiteSpace:'nowrap' }}>{val}{cfg.unit}</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
                              <div style={{ height:4, background:cfg.color, borderRadius:2, width:`${pct}%` }}/>
                            </div>
                            <div style={{ fontSize:10, color:c?.text4, minWidth:30, textAlign:'right' }}>{pct}%</div>
                          </div>
                          {macroTodayModal === 'calories' && (
                            <div style={{ display:'flex', gap:8, marginTop:6, fontSize:10, color:c?.text4 }}>
                              {meal.protein_g>0 && <span>💪 {Math.round(meal.protein_g)}g</span>}
                              {meal.carbs_g>0   && <span>⚡ {Math.round(meal.carbs_g)}g</span>}
                              {meal.fat_g>0     && <span>🫀 {Math.round(meal.fat_g)}g</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop:'1rem', textAlign:'center' }}>
                <button onClick={() => { setMacroTodayModal(null); window.location.href='/nutrition' }}
                  style={{ fontSize:12, color:c?.green2, background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  Adaugă masă nouă →
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Hidratare */}
      {WaterTracker && (
        <WaterTracker c={c} weightKg={body?.weight_kg || userProfile?.weight_kg} isMobile={isMobile}
          onUpdate={(newTotal) => setWaterToday(prev => ({ total_ml: newTotal, target_ml: prev?.target_ml || Math.round((body?.weight_kg || userProfile?.weight_kg || 80) * 35) }))}/>
      )}

      {/* Calorii Bar Chart */}
      <div style={s?.card}>
        <div onClick={() => setNutAccordion(p=>({...p, calories: !p?.calories}))}
          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' }}>
          <div style={s?.sectionLabel}>Calorii consumate</div>
          <span style={{ fontSize:14, color:c?.text4, transition:'transform 0.2s', transform: nutAccordion?.calories ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
        {nutAccordion?.calories && CaloriesBarChart && (
          <div style={{ marginTop:12 }}>
            <CaloriesBarChart
              data={nutritionHistory}
              tdee={nutritionTargets?.calories || 2000}
              c={c}
            />
          </div>
        )}
      </div>

      {/* Macros Bar Chart */}
      <div style={s?.card}>
        <div onClick={() => setNutAccordion(p=>({...p, macros: !p?.macros}))}
          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' }}>
          <div style={s?.sectionLabel}>Macronutrienti</div>
          <span style={{ fontSize:14, color:c?.text4, transition:'transform 0.2s', transform: nutAccordion?.macros ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
        {nutAccordion?.macros && MacrosBarChart && (
          <div style={{ marginTop:12 }}>
            <MacrosBarChart
              data={nutritionHistory}
              targets={{
                protein_g: nutritionTargets?.protein_g || 160,
                carbs_g:   nutritionTargets?.carbs_g    || 200,
                fat_g:     nutritionTargets?.fat_g      || 70,
              }}
              c={c}
            />
          </div>
        )}
      </div>

      {/* ── CARDURI INFORMATIVE DINAMICE: Partea de jos (Swipeable) ── */}
      {(() => {
        const cNutCard = {
          card: 'rgba(0,0,0,0.85)',
          border: 'rgba(255,255,255,0.18)',
          shadowHero: '0 4px 20px rgba(0,0,0,0.35)'
        }
        return (
          <div 
            style={{
              background: cNutCard.card,
              borderRadius: c?.radius || 16,
              padding: '14px 16px',
              marginBottom: CARD_GAP,
              border: `1px solid ${cNutCard.border}`,
              boxShadow: cNutCard.shadowHero
            }}
            onTouchStart={handleGuideTouchStart}
            onTouchEnd={handleGuideTouchEnd}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img 
                src={currentGuide.img} 
                alt="Ghid Nutriție" 
                style={{ width: 64, height: 64, borderRadius: c?.radiusSm || 8, objectFit: 'cover', flexShrink: 0 }} 
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{currentGuide.title}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                    Săpt {currentWeek} · {guideIndex + 1}/4 ↔
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', lineHeight: 1.5 }}>
                  {currentGuide.text}
                  {showMoreGuide && currentGuide.more}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button 
                    onClick={() => setShowMoreGuide(prev => !prev)}
                    style={{ background: 'transparent', border: 'none', color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    {showMoreGuide ? '▲ Mai puțin' : '▼ Mai mult'}
                  </button>

                  {/* Indicator Puncte pentru cele 4 Carduri din Săptămână */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {activeGuides.map((_, idx) => (
                      <div key={idx} style={{
                        width: guideIndex === idx ? 12 : 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: guideIndex === idx ? '#4ade80' : 'rgba(255,255,255,0.2)',
                        transition: 'all 0.2s'
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL FAVORITE / REȚETE SALVATE ── */}
      {showFavoritesSheet && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:600, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowFavoritesSheet(false)}>
          <div style={{ background:c?.card || '#111', borderRadius:'20px 20px 0 0', padding:'1.25rem', width:'100%', maxWidth:480, maxHeight:'85vh', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:16, fontWeight:700, color:c?.text }}>⭐ Rețete și Mese Favorite</div>
              <button onClick={() => setShowFavoritesSheet(false)}
                style={{ background:'transparent', border:'none', color:c?.text4, fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            
            {/* Căutare și sortare */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input placeholder="Caută în favorite..." value={favSearchQuery} onChange={e => setFavSearchQuery(e.target.value)}
                style={{ flex:1, padding:'8px 10px', borderRadius:8, border:`1px solid ${c?.border}`, background:c?.card2, color:c?.text, fontSize:12, outline:'none' }}/>
              <select value={favSort} onChange={e => setFavSort(e.target.value)}
                style={{ padding:'8px', borderRadius:8, border:`1px solid ${c?.border}`, background:c?.card2, color:c?.text, fontSize:12, outline:'none' }}>
                <option value="recent">Cele mai noi</option>
                <option value="name">Alfabetic</option>
                <option value="calories">Calorii</option>
                <option value="protein">Proteine</option>
              </select>
            </div>

            <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
              {favoritesLoading ? (
                <div style={{ textAlign:'center', padding:'2rem', color:c?.text4, fontSize:13 }}>Se încarcă favoritele...</div>
              ) : favoriteMeals.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:c?.text4, fontSize:13 }}>Nu ai nicio rețetă salvată la favorite.</div>
              ) : (
                favoriteMeals
                  .filter(m => !favSearchQuery || (m.name||'').toLowerCase().includes(favSearchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (favSort === 'name') return (a.name||'').localeCompare(b.name||'')
                    if (favSort === 'calories') return (b.calories||0) - (a.calories||0)
                    if (favSort === 'protein') return (b.protein_g||0) - (a.protein_g||0)
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
                  })
                  .map(fav => {
                    const isEditing = favEditId === fav.id
                    const isSwiped = swipedFavId === fav.id
                    return (
                      <div key={fav.id}
                        onPointerDown={e => { favTouchRef.current = { x: e.clientX, id: fav.id } }}
                        onPointerUp={e => {
                          const diff = e.clientX - favTouchRef.current.x
                          if (Math.abs(diff) > 50) setSwipedFavId(diff < 0 ? fav.id : null)
                        }}
                        style={{ background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:12, padding:10, border:`1px solid ${c?.border}`, position:'relative', overflow:'hidden' }}>
                        
                        {isEditing ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            <input value={favEditName} onChange={e => setFavEditName(e.target.value)} placeholder="Nume rețetă"
                              style={{ padding:'6px 8px', borderRadius:6, border:`1px solid ${c?.border}`, background:c?.card2, color:c?.text, fontSize:12 }}/>
                            <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                              <button onClick={() => setFavEditId(null)}
                                style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${c?.border}`, background:'transparent', color:c?.text4, fontSize:11, cursor:'pointer' }}>Anulează</button>
                              <button disabled={favEditSaving} onClick={async () => {
                                setFavEditSaving(true)
                                try {
                                  await supabase.from('meal_favorites').update({ name: favEditName }).eq('id', fav.id)
                                  setFavoriteMeals(prev => prev.map(m => m.id === fav.id ? { ...m, name: favEditName } : m))
                                  setFavEditId(null)
                                } catch(err) { console.error(err) }
                                setFavEditSaving(false)
                              }} style={{ padding:'4px 10px', borderRadius:6, border:'none', background:c?.green2, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>Salvează</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            {fav.image_url ? (
                              <img src={fav.image_url} alt="" style={{ width:48, height:48, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
                            ) : (
                              <div style={{ width:48, height:48, borderRadius:8, background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>⭐</div>
                            )}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:600, color:c?.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fav.name}</div>
                              <div style={{ fontSize:11, color:c?.text4, marginTop:2, display:'flex', gap:8 }}>
                                <span style={{ color:c?.text }}>{Math.round(fav.calories||0)} kcal</span>
                                {fav.protein_g > 0 && <span style={{ color:'#f0a830' }}>P {Math.round(fav.protein_g)}g</span>}
                                {fav.carbs_g > 0 && <span style={{ color:'#60a5fa' }}>C {Math.round(fav.carbs_g)}g</span>}
                                {fav.fat_g > 0 && <span style={{ color:'#f87171' }}>G {Math.round(fav.fat_g)}g</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              <button onClick={() => { setPortionFav(fav); setPortionQty(1) }}
                                style={{ padding:'6px 12px', borderRadius:8, border:'none', background:c?.green2, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>Adaugă</button>
                              {isSwiped && (
                                <>
                                  <button onClick={() => { setFavEditId(fav.id); setFavEditName(fav.name); setSwipedFavId(null) }}
                                    style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${c?.border}`, background:'transparent', color:c?.text, fontSize:11, cursor:'pointer' }}>✏️</button>
                                  <button disabled={favDeletingId === fav.id} onClick={async () => {
                                    setFavDeletingId(fav.id)
                                    try {
                                      await supabase.from('meal_favorites').delete().eq('id', fav.id)
                                      setFavoriteMeals(prev => prev.filter(m => m.id !== fav.id))
                                    } catch(err) { console.error(err) }
                                    setFavDeletingId(null)
                                  }} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'#f87171', color:'#fff', fontSize:11, cursor:'pointer' }}>{favDeletingId === fav.id ? '...' : '🗑️'}</button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
              )}
            </div>

            {/* Modal Ajustare Porție pentru Favorite */}
            {portionFav && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={() => setPortionFav(null)}>
                <div style={{ background:c?.card || '#111', borderRadius:16, padding:'1.5rem', width:'90%', maxWidth:360 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize:15, fontWeight:700, color:c?.text, marginBottom:4 }}>Ajustează porția</div>
                  <div style={{ fontSize:12, color:c?.text4, marginBottom:16 }}>{portionFav.name}</div>
                  
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:20 }}>
                    <button onClick={() => setPortionQty(q => Math.max(0.25, Number((q - 0.25).toFixed(2))))}
                      style={{ width:36, height:36, borderRadius:'50%', border:`1px solid ${c?.border}`, background:c?.card2, color:c?.text, fontSize:18, cursor:'pointer' }}>-</button>
                    <span style={{ fontSize:20, fontWeight:800, color:c?.text, minWidth:60, textAlign:'center' }}>{portionQty}x</span>
                    <button onClick={() => setPortionQty(q => Number((q + 0.25).toFixed(2)))}
                      style={{ width:36, height:36, borderRadius:'50%', border:`1px solid ${c?.border}`, background:c?.card2, color:c?.text, fontSize:18, cursor:'pointer' }}>+</button>
                  </div>

                  <div style={{ background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:10, padding:10, marginBottom:16, display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:c?.text }}>{Math.round((portionFav.calories||0)*portionQty)}</div>
                      <div style={{ fontSize:10, color:c?.text4 }}>kcal</div>
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#f0a830' }}>{Math.round((portionFav.protein_g||0)*portionQty)}g</div>
                      <div style={{ fontSize:10, color:c?.text4 }}>Proteine</div>
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#60a5fa' }}>{Math.round((portionFav.carbs_g||0)*portionQty)}g</div>
                      <div style={{ fontSize:10, color:c?.text4 }}>Carbs</div>
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#f87171' }}>{Math.round((portionFav.fat_g||0)*portionQty)}g</div>
                      <div style={{ fontSize:10, color:c?.text4 }}>Grăsimi</div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setPortionFav(null)}
                      style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${c?.border}`, background:'transparent', color:c?.text3, fontSize:12, fontWeight:600, cursor:'pointer' }}>Anulează</button>
                    <button disabled={portionSaving} onClick={async () => {
                      setPortionSaving(true)
                      try {
                        const { data: { session } } = await supabase.auth.getSession()
                        const payload = {
                          user_id: user?.id,
                          name: portionFav.name,
                          calories: Math.round((portionFav.calories||0)*portionQty),
                          protein_g: Math.round((portionFav.protein_g||0)*portionQty * 10) / 10,
                          carbs_g: Math.round((portionFav.carbs_g||0)*portionQty * 10) / 10,
                          fat_g: Math.round((portionFav.fat_g||0)*portionQty * 10) / 10,
                          fiber_g: Math.round((portionFav.fiber_g||0)*portionQty * 10) / 10,
                          date: nutDateStr,
                          time: new Date().toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' }),
                          image_url: portionFav.image_url
                        }
                        await supabase.from('meal_entries').insert([payload])
                        if (qc) qc.invalidateQueries(['meal_entries'])
                        setPortionFav(null)
                        setShowFavoritesSheet(false)
                        setFavAddedToast(true)
                        setTimeout(() => setFavAddedToast(false), 3000)
                      } catch(err) { console.error(err) }
                      setPortionSaving(false)
                    }} style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:c?.green2, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      {portionSaving ? 'Se adaugă...' : 'Adaugă în jurnal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast adăugare din favorite */}
      {favAddedToast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:c?.green2 || '#1d9e75', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:600, zIndex:800, boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>
          ✓ Masă adăugată cu succes în jurnal!
        </div>
      )}
    </div>
  )
}
