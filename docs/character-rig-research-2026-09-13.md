# Mara: istraživanje i novi postupak izrade riga

Datum: 13. rujna 2026. Status: istraživanje i izolirana tehnička proba. V4 ostaje glavni lokalni prikaz; V5 artwork nije prihvaćen. Ništa od ovoga ne mijenja produkcijski svijet.

## Zaključak

Spine + PixiJS ostaju prikladan smjer. Naš problem nalazi se u pripremi artworka, njegovoj registraciji na kostur i provjeri deformacije. Promjena runtimea sama neće uskladiti perspektivu, proporcije ili loše nacrtan spoj. To je zaključak pregleda našeg koda i slika, a ne tvrdnja proizvođača.

Prethodni generator mapirao je sve ruke na unaprijed zadane dubine i širine. Izvorni lakat, rub rukava i zapešće nisu imali zabilježene koordinate. Zbog toga su se proporcije mijenjale već u početnoj pozi. V4 šaka i podlaktica potjecale su iz različitih generacija, s različitim svjetlom i proporcijama. V5 je uklonio neke rezove, ali promijenio siluetu i dodao neusklađena ramena i kukove. Povećavanje dlana, pomicanje slojeva i alpha fade nisu dovoljni za rješavanje tih problema.

## Što kažu službeni izvori

1. **Artwork i registracija slojeva.** Spine podržava uvoz PSD-a. Službeni Photoshop alat može izvesti slike slojeva, njihove položaje i referentnu složenu sliku. Za nas to znači jedan koordinatni sustav, jedan odobreni crtež i očuvane lokacije dijelova, umjesto naknadnog nagađanja gdje ih postaviti. [Službeni Photoshop/PSD workflow](https://github.com/EsotericSoftware/spine-scripts/tree/master/photoshop).
2. **Topologija prati oblik.** Vrhove treba rasporediti uz konturu, pregibe i značajke koje se trebaju odvojeno deformirati. Početi jednostavno, zatim dodavati samo potrebne vrhove. Ravni izvori uglavnom dopuštaju širi raspon savijanja od unaprijed savijenih. [Vertex placement](https://esotericsoftware.com/blog/Mesh-creation-tips-vertex-placement).
3. **Težine se provjeravaju u pozama.** Bind povezuje mrežu s kostima; automatske težine nisu zamjena za provjeru. Važni su lokalni utjecaji i redoslijed trokuta kada se mreža preklapa. [Weights](https://esotericsoftware.com/spine-weights), [Mesh weight workflows](https://esotericsoftware.com/blog/Mesh-weight-workflows).
4. **Oštar pregib može izgubiti volumen.** Spineov autor objašnjava ograničenje linear blend skinninga i predlaže dodatnu kost na zglobu ili lokalne korekcije. Ta stara rasprava objašnjava mehanizam, nije dokaz da je naša konkretna mreža kvalitetna. [Joint-volume discussion](https://esotericsoftware.com/forum/d/7673-best-practices-for-rigging-mesh-joints).
5. **Stopala i kukovi imaju različite kontrole.** Spineboy postavlja IK mete izvan hijerarhije kukova, tako da se kukovi mogu pomicati uz oslonjeno stopalo. Posebne kontrole stopala omogućuju odizanje pete i oslonac prstiju. [Spineboy](https://esotericsoftware.com/spine-examples-spineboy).
6. **Granice deformacije.** Dokumentacija preporučuje prvenstveno težine, a deform keys umjereno. Rezanje neprozirnih piksela rubom mreže može proizvesti nazubljen rub. [Mesh attachments](https://esotericsoftware.com/spine-meshes).

## Konkretan art brief

- Zaključati jedan odobreni Mara master: siluetu, visinu glave, širinu ramena, duljine nadlaktice/podlaktice i odnos šake prema licu. Ne generirati cijeli novi lik radi popravka zapešća.
- Jedna neutralna poza, jedna perspektiva i jedan smjer svjetla. Bočni hod zahtijeva artwork prikladan tom smjeru; frontalni/tri-četvrtinski pogled ne pretvarati u bočni hod velikim horizontalnim zamahom.
- Organizirati slojeve: kosa iza, dalja ruka, trup, vrat, glava, ovratnik/šal ispred vrata, bliža ruka, zdjelica, obje noge, stopala. Konačni draw order odrediti prema stvarnoj perspektivi mastera.
- Vrat mora imati nacrtan nastavak ispod ovratnika. Torzo ne smije imati vidljiv završni poklopac vrata. Ramena moraju imati dovoljno skrivenog artworka za zakretanje i predviđen spoj rukava.
- Šake: relaxed/open/grip su zasebne poze istog lika s istom lokacijom zapešća i mjerilom. Ako se mijenja pogled na podlakticu, koristiti usklađen komplet, ne samo rotirati pogrešnu šaku.
- Nazive left/right koristiti anatomski; zabilježiti i near/far za svaku perspektivu. Zrcaljenje ne smije zamijeniti suprotne palčeve ili okrenuti nacrtano osvjetljenje.
- Pravi alpha kanal, očišćeni rubovi i padding. Nacrtana šahovnica nije transparentnost. Generacija je ulaz za pripremu, ne gotov Spine asset.

## Redoslijed izvedbe

1. Sastaviti master u mirovanju. Zabilježiti koordinate ramena, lakta, zapešća, kukova, koljena, gležnja i oslonca prstiju. Kostur prilagoditi crtežu.
2. Izolirano testirati ruku. Rest pose mora reproducirati izvor bez rastezanja. Provjeriti lakat na 0/45/90/120 stupnjeva i zapešće na -25/0/25, uz prikaz konture i mreže.
3. Provjeriti vrat pri malim nagibima i ovratnik kao zaseban prednji sloj. Bez odrezanog ruba, praznine ili promjene duljine vrata.
4. Tek zatim spojiti ruke s ramenima i provjeriti mirnu pozu, razgovor i mahanje. Usporediti s masterom u istoj veličini.
5. Izraditi kontakt/down/passing/up poze hoda. Peta i prsti imaju logičan kontakt s podlogom; kukovi prenose težinu, trup kompenzira, ruke rade suprotno nogama. Provjeriti i suprotni korak. Kontrola nekrižanja stopala vrijedi samo za odabrani tri-četvrtinski hod, ne univerzalno za sve perspektive.
6. Tek nakon provjere siluete i spojeva dodavati treptanje, govor, kosu i sekundarnu animaciju.

## Što je napravljeno nakon istraživanja

Odvojeni `/experiments/characters/joint-lab` koristi postojeći generirani arm asset samo kao tehnički uzorak. Dva prikaza imaju iste proporcije i izmjerene početne točke: osnovno blendanje i kandidat s potpornom kosti lakta. Izvor se ne generira ponovno i V4 se ne mijenja.

Generator računa lokalne koordinate vrhova inverznom transformacijom svake kosti iz iste izvorne točke. Testovi provjeravaju reprodukciju početnog crteža i volumen središnjeg reda lakta. To su geometrijske provjere; nisu potvrda anatomije ili umjetničke kvalitete. Landmarki su ručno procijenjeni i nisu motion capture.

Na očekivanoj putanji `/Applications/Spine*` nije pronađen editor. To ne dokazuje da ga nema drugdje. Trenutačni rezultat je runtime/JSON studija, ne projekt ručno dovršen u Spine Editoru. Za završno authoring rješenje treba provjeriti editor i postojeću licencu prije distribucije; ta provjera ne blokira lokalno istraživanje.

## Kriterij prihvaćanja

Nema zamjene glavnog lika samo zato što se datoteka učitala ili testovi prolaze. Potrebni su: očuvana silueta mastera, prirodni spojevi pri uvećanju, pregled cijelog ciklusa, mali prikaz u svijetu i usporedba prije/poslije. Ako je proba lošija, ostaje izolirana i bilježi se razlog.

## Nastavak: arm-only kandidat

`/experiments/characters/harbor/arm-candidate` dodaje kalibrirani skeleton ruke iz joint-laba na kopiju V4. Zadržava izvorne lokalne odnose kostiju; sve se jednoliko skalira faktorom 0.013 i postavlja na rame. Mijenja samo artwork i rig ruke pri mahanju. Idle, hod i ostale geste koriste V4 ruke. Vrat se ovim korakom ne mijenja.

Izvorna slika ruke već je postojala; nije rađena nova generacija. Test uspoređuje sve izvorne kosti, attachmente i ključeve animacija s V4. Poseban niz učitava kandidat i provjerava njegove mreže kroz sve animacije.

Vizualno provjereno u mahanju na 50% i 70%: nema zasebne granice između dlana i podlaktice. Ton novog rukava još se razlikuje od košulje, a postavljanje ramena ostaje predmet pregleda. Kandidat nije proglašen završenim niti postavljen kao glavni prikaz.

Rebuild: nakon promjena izvora redom pokrenuti `build-mara-painted.mjs`, `build-joint-lab.mjs`, `build-mara-arm-candidate.mjs`. Ti generatori daju odvojene izlazne direktorije.

## Proširenje kandidata na cjelinu

Po zahtjevu korisnika kandidat sada uključuje i vrat te hod. Izvorni neprozirni head atlas zamjenjuje prethodno alpha-featheranu verziju samo u kandidatu; skraćen je rastegnuti donji vrat i ograničen desni rub koji je izlazio izvan ovratnika. V4 ostaje netaknut. Kod hoda su zadržane točke spajanja s kukovima, smanjena izbočina gornje natkoljenice i povećan prijenos težine uz izračun visine oslonjene noge.

Pokušaj vezivanja vrha rukava izravno za trup proizveo je loš pregib u podignutoj pozi i uklonjen je nakon vizualne provjere. Kandidat umjesto toga blago podiže rame uz ruku. Nijanse novog rukava još nisu u potpunosti usklađene s originalnom košuljom. Ova bilješka nadopunjuje raniji arm-only status; kandidat još nije glavni prikaz.
