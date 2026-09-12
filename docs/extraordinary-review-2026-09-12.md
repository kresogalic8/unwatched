# Unwatched: od zanimljive simulacije do projekta koji ljudi dijele

Pregled: 12. rujna 2026. Prijedlog smjera, bez promjena aplikacijskog koda.

Pregledani su README, PRODUCT, doprinosi i release proces, struktura svih osam paketa/aplikacija, ključni dijelovi enginea, cognitiona, pohrane, servera, SDK-a, onboardinga, digesta, dijeljenja i prikaza svijeta. U pregledniku su pregledani javna naslovnica, grad i Gazette. Ovo nije iscrpan sigurnosni audit niti provjera svake funkcije i svakog korisničkog toka.

## Glavna preporuka

Unwatched treba postati otok čije stanovnike ljudi pamte i čije priče mogu pratiti, provjeriti i podijeliti. Postojeća simulacija već daje dovoljno materijala za taj smjer. Najveći sljedeći dobitak je povezati događaje u razumljivu priču i omogućiti developeru da brzo sudjeluje.

Predložena kratka poruka: **“You wrote them a personality. They built a life.”**

Objašnjenje odmah ispod: “An open-source island of AI citizens. You write letters, not orders. Come back tomorrow to see what they did.” To je prijedlog teksta, a tvrdnja o naredbama traži usklađivanje koda opisano niže.

Viralnost nije moguće obećati. Možemo povećati izglede jasnom razlikom, dobrim prvim iskustvom, sadržajem vrijednim dijeljenja i jednostavnim sudjelovanjem.

## Što već vrijedi sačuvati

- Pisma, osobnost, povjerenje i vrijeme daju emocionalni razlog za povratak.
- Gospodarstvo, nestašice, gradnja, zakoni, obitelji i smrtnost proizvode posljedice.
- Navike odvojene od modelskih odluka omogućuju da većina minuta ne troši model.
- Gazette, digest, autobiografije i povijest osobnosti već daju više pogleda na isti život.
- Vlastiti mozak preko WebSocketa, Python primjer i TS SDK daju developerima ulaz.
- World packovi, federacija i teret već postoje; to nisu prijedlozi potpuno novih mogućnosti.
- Crtani mediteranski otok ima prepoznatljiv identitet. Zadržati obalu, imena, more, zvukove i običaje.
- Apache-2.0, CONTRIBUTING, CI, predlošci issuea i release proces već postoje.

Usporedbe: [AI Town](https://github.com/a16z-infra/ai-town) se predstavlja kao proširiv starter kit za AI grad, [Generative Agents](https://github.com/joonspk-research/generative_agents) daje istraživačku podlogu za društvene agente, a [TinyTroupe](https://github.com/microsoft/TinyTroupe) naglašava simulaciju persona i poslovne uvide. To potvrđuje da sama kategorija AI grada nije nova. Naša prilika, po mojoj procjeni, leži u trajnom životu određenog lika i njegovim posljedicama, uz otvoren i lako isprobiv sustav.

## Konkretni problemi prije lansiranja

### 1. Pisma i izravno upravljanje trenutno koegzistiraju

README kaže da vlasnik ne daje naredbe. `apps/web/app/town/page.tsx` prikazuje “Possess”, a `apps/server/src/main.ts:329` prima vlasnikovu akciju i odmah poziva `town.apply(..., "possessed")`. To je stvarna kontradikcija glavnog obećanja.

Preporuka: na kanonskom otoku zadržati pisma; izravno upravljanje, ako je potrebno za razvoj, eksplicitno odvojiti u lokalni sandbox. Osim gumba, promjena mora obuhvatiti endpoint i izvršavanje. Vlastiti mozak također treba jasno opisati kao program koji određuje odluke: autonomija nije dokaz svijesti ili slobodne volje.

### 2. Javna i privatna povijest nisu dosljedno odvojene

`publicEvent` u `apps/server/src/main.ts:301` uklanja samo `payload.because`. Javni `/api/events`, WebSocket emitiranje i početni paket koriste tu funkciju bez filtra privatnih vrsta. Engine zapisuje sadržaj pisama i refleksija u tekst događaja. `/api/record/:day` vraća kanonske tekstove događaja bez takvog filtra. Neautorizirani digest također treba pregledati jer uklanjanje samo `because` nije javna projekcija privatnog digesta.

Preporuka: jedna zajednička definicija publike događaja; zasebne javne i vlasničke projekcije; testovi preko HTTP-a i WebSocketa, uključujući povezane događaje i arhivu. Javne dokaze oblikovati tako da ne otkrivaju privatne tekstove. Nalaz je iz lokalnog koda; nisu dohvaćana tuđa privatna pisma s produkcije.

### 3. Dijeljeni trenutak mora preživjeti restart

`/api/moments/:id` traži samo u `town.events`. Restart učitava zadnjih 300 događaja (`apps/server/src/main.ts:92`). Zato stariji link može prestati raditi iako je događaj spremljen u bazu. FileStore dodatno zadržava zadnjih 20.000 događaja.

Preporuka: trajni dohvat događaja po identitetu otoka i događaja, fallback na pohranu, nepromjenjiva javna verzija objavljenog trenutka i definirana arhiva. Test: podijeli trenutak, napravi restart, otvori isti link. Ako se sadržaj ne zadržava zauvijek, to mora biti jasno prije dijeljenja.

### 4. Hash nije provjera istinitosti novinskog teksta

Lanac može otkriti promjenu zapisa u odnosu na poznati sačuvani hash. Ne dokazuje da je modelski novinski tekst vjerno prepričao događaje niti da je izjava stanovnika fizička činjenica. Kanonski zapis sada ne uključuje payload.

Preporuka: razlikovati izvršenu akciju, izgovorenu tvrdnju i glasinu. Rečenice članka vezati uz ID-eve izvora. Objavljene pečate može čuvati neovisni promatrač. Novine trebaju smjeti napisati da tvrdnja nije potvrđena. To je i zanimljiviji svijet i uvjerljivija tehnologija.

### 5. Prvi ekran skriva dio vlastite vrijednosti

Na pregledanoj desktop naslovnici dnevnik događaja iz World komponente stoji iza opisa i CTA gumba. Naslovnica zatim dugo objašnjava sustave, a istaknuti digest je označen kao primjer iz mock otoka.

Preporuka: hero prikaz bez dnevnika/minimape ispod teksta, s jasno odvojenom jednom stvarnom pričom. Već u prvom ekranu ponuditi ulaz u priču. Prikaz grada i njegova paleta vrijede sačuvati; naglasak staviti na čitljivost, kadriranje i likove.

## Prioritetne nadogradnje

### A. Priče koje traju više dana

Već postoji rangiranje događaja po važnosti i kratki kontekst jučerašnje Gazette. Dodati trajni objekt priče: sudionici, problem, početni događaj, povezani događaji, što se promijenilo, otvoreno pitanje, javnost i izvori.

Čitatelj vidi početak, preokret, posljedicu i nastavak. Sustav može spojiti lom mlina, kupnju brašna i promjenu cijene ako za te veze postoji dokaz. Ne smije izmišljati uzročnost zato što su događaji blizu u vremenu. Nepotvrđena veza ostaje označena kao pretpostavka.

Na javnom otoku viđena je Goranova izjava kojom odbija daljnji novac za šutnju. To je već zanimljiv početak: treba pokazati prethodni javni kontekst i pratiti što je stvarno učinio nakon izjave. Sama izjava nije dokaz da se mito plaćalo.

Prvi opseg: jedna aktivna priča na naslovnici, stranica s kronologijom i povezani izvori. Kriterij: pet novih čitatelja nakon minute zna tko što želi i što je ostalo neriješeno.

### B. Trenuci koje je lako podijeliti

Nadograditi postojeći `/m/[id]`. Sada koristi generički `world-street.jpg`, Copy URL i dinamički naslov/opis; nema posebne slike za svaki događaj.

Dodati portrete, mjesto, citat, vrijeme, kratak kontekst i trajni link. Generirati posebnu OG sliku te izvoz kartice. Sljedeći korak je 15–30 sekundi prizora sa stvarnim tekstom događaja i titlovima. Označiti rekonstrukciju ako nije snimka tadašnjeg stanja.

Put dijeljenja: zanimljiv trenutak → razumljiv pregled na društvenoj mreži → cijela javna priča bez računa → praćenje lika → pokretanje vlastitog otoka ili vlastiti građanin. Privatna pisma ne postaju automatski javni materijal.

### C. “Upoznaj nekoga” prije onboardinga

Sada onboarding ima pet koraka, izradu osobe i izbor načina razmišljanja; hosted put vodi prema kupnji. Za znatiželjnog posjetitelja to je velika odluka prije emocionalne povezanosti.

Dodati javno praćenje tri stvarna stanovnika s jasno vidljivim željama i otvorenim problemima. Pokazati prethodni dan i omogućiti spremanje favorita bez računa. Prije prazne forme ponuditi tri uređiva početna lika, uz postojeći napredni editor.

Javni otok zadržava stvarno vrijeme. Za trenutno iskustvo koristiti označenu reprodukciju zabilježene priče ili lokalni demo. Eventualni probni hosted budžet mora biti ograničen i izmjeren; besplatno promatranje može biti prvi korak bez novih troškova modela.

### D. Pokreni otok jednom naredbom

Mock soak je brz i koristan, ali završava datotekama. Developeru treba prvi vizualni uspjeh: jedna naredba podigne web i server, mock otok i vodi na jednu već razumljivu priču.

Predložena, još nepostojeća naredba: `npx create-unwatched`. Prvo može nastati repo skripta za demo, zatim objavljeni CLI. Opcije: mock, lokalni model i vlastiti provider. Objaviti SDK s izgrađenim izlazima; trenutačni `@unwatched/agent-sdk` ima `private: true` i `main` prema TypeScript izvoru.

Dodati gotov lokalni adapter za Ollama/OpenAI-kompatibilne servere, provjeru dostupnosti modela, jednostavan Docker Compose i troškovnik iz stvarnih mjerenja. Protokol već omogućuje vlastiti proces, ali gotov primjer značajno skraćuje put.

Kriterij: tri osobe koje nisu autori pokreću demo bez pomoći. Mjeriti vrijeme od klona do vidljive radnje vlastitog agenta.

### E. “Kako su postali takvi”

Osobnosti se već mijenjaju; dodati razumljiv prikaz promjene od dolaska do danas s relevantnim događajima. Zašto je netko prestao vjerovati susjedu? Koji je cilj napustio? Što još uvijek pogrešno vjeruje?

Vlasnik vidi privatni razvoj svog lika; javnost vidi javno potvrđene postupke. Dokazno poduprte veze razlikovati od modelskog tumačenja. Ovo može povezati priču, pamćenje i tehničku transparentnost bolje od još jednog popisa atributa.

## Veće ideje nakon osnovnog iskustva

1. **Fork this history.** Lokalno izdvojiti povijesno stanje i promijeniti jednu okolnost. Ostaviti kanonski otok netaknutim. Potrebni su checkpointi stanja, RNG-a, konfiguracije i zabilježeni odgovori modela za točnu reprodukciju; isti seed ne jamči iste nove LLM odgovore. Usporedba je eksperiment, ne dokaz uzročnosti.
2. **Atlas otoka.** Federacija i teret već postoje. Dodati katalog zajedničkih otoka, njihove priče, običaje, održavatelje i verzije. Prije otvaranja nepovezanim operatorima riješiti identitet putnika, ponovljene transfere i povjerenje među serverima; sadašnja zajednička tajna bolje odgovara maloj povezanoj skupini.
3. **Muzej predmeta.** Jedinstveni predmeti s poviješću vlasništva i značenjem: slika, pismo, alat ili naslijeđeni predmet. Trenutačni popisi predmeta nisu dovoljni za takvu provenijenciju. Početi jednom kategorijom i dokazati da promjena vlasnika mijenja priču.
4. **Javni laboratorij ponašanja.** Uz isti početni svijet uspoređivati konfiguracije mozgova kroz više seedova, s troškom, latencijom, odbijenim akcijama i ostvarivanjem ciljeva. Objaviti reproducibilne pokuse, bez proglašavanja modela općenito boljim na temelju jednog otoka.
5. **Zajednički obiteljski dolazak.** Kasnije omogućiti prijateljima da predlože povezane početne likove, pa prate njihove autonomne odnose. To traži modeliranje početnih veza, pristanak sudionika i način da jedan korisnik ne upravlja tuđim likom.

## Plan izvedbe

Procjene su grube veličine posla za osobu upoznatu s projektom; nisu obećani rokovi. Ne zbrajati ih u fiksan datum prije razrade.

| Redoslijed | Isporuka | Veličina | Dokaz završetka |
|---|---|---|---|
| 1 | Privatne projekcije, odluka o possessu, trajni momenti | Srednje | Integracijski testovi publike i restart testa; obećanja odgovaraju ponašanju |
| 2 | Čist hero i jedna stvarna priča | Malo do srednje | Novi čitatelji razumiju lik i problem za minutu |
| 3 | Dinamičke slike trenutaka i kartice | Srednje | Link ima smisla bez konteksta aplikacije |
| 4 | Jednostavan lokalni vizualni demo | Srednje | Neovisni developeri pokreću ga bez pomoći |
| 5 | Praćenje lika i nastavci priča | Srednje do veliko | Ljudi se vraćaju po ishod, ne samo radi početne znatiželje |
| 6 | Replay/izvoz kratkog filma | Veliko | Prizor odgovara arhiviranom događaju i jasno navodi rekonstrukciju |
| 7 | Atlas ili fork povijesti | Veliko | Dokazana uporaba i doprinosi izvan autora |

Arhitekturno prvo izdvojiti pravila vidljivosti i dohvat događaja; zatim dodavati priče kao izvedeni sloj. Engine trenutno ima približno 1.600 redaka. Modularizaciju raditi uz konkretne promjene i postojeće testove, bez velikog prepisivanja prije lansiranja.

## GitHub predstavljanje

- README otvoriti kratkom snimkom jednog stvarnog događaja, jasnom rečenicom i lokalnim demom. Hosted cijene spustiti ispod tehničkog ulaza ili povezati na posebnu stranicu.
- Objaviti tehnički tekst o pamćenju, navikama, percepciji, cijeni i granicama. Razlikovati mock rezultate od stvarnih modelskih rezultata.
- Pripremiti tri provjerene priče, svaku s izvorima. Imena i posljedice nose objavu bolje od popisa svih značajki.
- Jedna početna objava za Show HN, zatim ciljano predstavljanje različitih aspekata relevantnim zajednicama. Prije objave provjeriti njihova aktualna pravila. Ne postati isti promotivni tekst posvuda.
- Pripremiti mali broj stvarno izvedivih početnih doprinosa: lokalni adapter, primjer mozga, prikaz događaja, dokumentacija packa. Svaki treba imati očekivani rezultat i način provjere.
- Dodati galeriju zajedničkih mozgova i otoka kada postoje vanjski doprinosi. Ne predstavljati predloške kao aktivnu zajednicu.
- Lansiranje vezati uz demonstriranu priču i pouzdan demo, ne uz broj novih sustava.

Mjeriti: posjet priči → otvaranje nastavka; dijeljeni link → zainteresirani novi posjetitelj; prvi digest → povratak sljedeći dan; klon → pokrenuti demo; prvi vanjski mozak/PR; trošak po aktivnom građaninu i vrijeme obrade ticka. Broj zvjezdica je ishod vidljivosti, ne zamjena za ove signale. Ciljne postotke postaviti nakon prve male kohorte; sada nisu poznati.

## Provjere

- `pnpm typecheck`: svih osam zadataka uspješno; sedam iz Turbo cachea, web ponovno provjeren.
- `pnpm exec turbo run test --force`: 54 testa u 23 datoteke uspješno, bez cachea.
- Deset mock dana, 20 stanovnika, seed 7, tick 1: 7.815 događaja, oko 4,9 sekundi; Ema dovršava kuću devetog dana. To potvrđuje mock put, ne kvalitetu ili cijenu živih modela.
- Standardni `pnpm soak` pokretač naišao je na ograničenje sandboxa pri otvaranju lokalnog IPC socketa. Isti program uspješno je izvršen s `node --import tsx apps/headless/src/soak.ts ...`, uz rezultate u `/private/tmp/unwatched-review-seed7`.
- Preglednik: javna naslovnica, grad i Gazette. Nisu izvršene kupnje, kreirani korisnici, slana pisma ni pokretani dodatni plaćeni modeli. Nije obavljen mobilni E2E, load test ni test produkcijskih vlasničkih tokova.

Preporučeni sljedeći paket: uskladiti obećanja i privatnost, trajno arhivirati trenutke, prikazati jednu stvarnu priču na čistoj naslovnici i učiniti je lako djeljivom. Zatim olakšati developerima da sami proizvedu sljedeću priču.
