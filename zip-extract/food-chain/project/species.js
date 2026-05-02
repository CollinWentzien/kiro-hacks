// Species dataset for Food Chain
// Each species: id, name, latin, kind (plant|invertebrate|fish|amphibian|reptile|bird|mammal),
// env (backyard|terrarium|freshwater|saltwater|pond), climate (temperate|tropical|arid),
// trophic (producer|primary|secondary|tertiary|decomposer),
// eats: [ids], eatenBy: [ids], img, blurb
// Photos use Wikimedia Commons direct URLs (public domain / CC).

const SPECIES = [
  // ───────── BACKYARD / GARDEN ─────────
  {
    id: "oak", name: "White Oak", latin: "Quercus alba",
    kind: "plant", env: ["backyard"], climate: ["temperate"],
    trophic: "producer", eats: [], eatenBy: ["squirrel", "deer", "caterpillar"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Quercus_alba.jpg?width=640",
    blurb: "Keystone canopy tree. Acorns feed dozens of species; leaves host hundreds of caterpillar species."
  },
  {
    id: "milkweed", name: "Common Milkweed", latin: "Asclepias syriaca",
    kind: "plant", env: ["backyard"], climate: ["temperate"],
    trophic: "producer", eats: [], eatenBy: ["caterpillar", "bee"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Asclepias_syriaca_Prairie_Ridge.jpg?width=640",
    blurb: "Sole host plant for monarch caterpillars. Nectar source for bees and butterflies."
  },
  {
    id: "clover", name: "White Clover", latin: "Trifolium repens",
    kind: "plant", env: ["backyard"], climate: ["temperate"],
    trophic: "producer", eats: [], eatenBy: ["rabbit", "deer", "bee"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Trifolium_repens_close.jpg?width=640",
    blurb: "Nitrogen-fixing groundcover. Lawn alternative that feeds pollinators."
  },
  {
    id: "caterpillar", name: "Monarch Caterpillar", latin: "Danaus plexippus",
    kind: "invertebrate", env: ["backyard"], climate: ["temperate", "tropical"],
    trophic: "primary", eats: ["milkweed"], eatenBy: ["robin", "spider"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Monarch_Butterfly_Caterpillar_-_5th_Instar_2.jpg?width=640",
    blurb: "Toxic from milkweed alkaloids. Most predators learn to avoid the orange-and-black warning."
  },
  {
    id: "bee", name: "European Honeybee", latin: "Apis mellifera",
    kind: "invertebrate", env: ["backyard"], climate: ["temperate", "tropical"],
    trophic: "primary", eats: ["milkweed", "clover"], eatenBy: ["spider", "robin"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Apis_mellifera_Western_honey_bee.jpg?width=640",
    blurb: "Pollinator. Visits hundreds of flower species; critical for fruiting plants."
  },
  {
    id: "spider", name: "Garden Spider", latin: "Argiope aurantia",
    kind: "invertebrate", env: ["backyard"], climate: ["temperate"],
    trophic: "secondary", eats: ["bee", "caterpillar"], eatenBy: ["robin"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Yellow_garden_spider.jpg?width=640",
    blurb: "Orb weaver. Spins a fresh web nightly; eats almost any insect that lands."
  },
  {
    id: "earthworm", name: "Earthworm", latin: "Lumbricus terrestris",
    kind: "invertebrate", env: ["backyard"], climate: ["temperate"],
    trophic: "decomposer", eats: [], eatenBy: ["robin", "mole"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Lumbricus_terrestris_R.H.jpg?width=640",
    blurb: "Soil engineer. Aerates and fertilizes; converts leaf litter to castings."
  },
  {
    id: "rabbit", name: "Eastern Cottontail", latin: "Sylvilagus floridanus",
    kind: "mammal", env: ["backyard"], climate: ["temperate"],
    trophic: "primary", eats: ["clover", "milkweed"], eatenBy: ["hawk", "fox"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Rabbit_in_montana.jpg?width=640",
    blurb: "Crepuscular browser. Will graze any tender shoot; populations boom without predators."
  },
  {
    id: "squirrel", name: "Gray Squirrel", latin: "Sciurus carolinensis",
    kind: "mammal", env: ["backyard"], climate: ["temperate"],
    trophic: "primary", eats: ["oak"], eatenBy: ["hawk", "fox"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Sciurus-carolinensis-002.jpg?width=640",
    blurb: "Cache-hoarder. Buries acorns and forgets many — accidentally plants oak forests."
  },
  {
    id: "deer", name: "White-tailed Deer", latin: "Odocoileus virginianus",
    kind: "mammal", env: ["backyard"], climate: ["temperate"],
    trophic: "primary", eats: ["oak", "clover"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/White-tailed_deer.jpg?width=640",
    blurb: "Edge-habitat browser. Without predators (wolves, cougars), populations explode."
  },
  {
    id: "robin", name: "American Robin", latin: "Turdus migratorius",
    kind: "bird", env: ["backyard"], climate: ["temperate"],
    trophic: "secondary", eats: ["earthworm", "caterpillar", "spider", "bee"], eatenBy: ["hawk"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Turdus-migratorius-002.jpg?width=640",
    blurb: "Generalist insectivore in spring; switches to berries in fall. Common lawn forager."
  },
  {
    id: "hawk", name: "Red-tailed Hawk", latin: "Buteo jamaicensis",
    kind: "bird", env: ["backyard"], climate: ["temperate", "arid"],
    trophic: "tertiary", eats: ["rabbit", "squirrel", "robin", "mole"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Buteo_jamaicensis_-John_Heinz_National_Wildlife_Refuge_at_Tinicum%2C_Pennsylvania%2C_USA-8.jpg?width=640",
    blurb: "Apex aerial predator in suburban skies. Soars on thermals; dives at small mammals."
  },
  {
    id: "fox", name: "Red Fox", latin: "Vulpes vulpes",
    kind: "mammal", env: ["backyard"], climate: ["temperate"],
    trophic: "tertiary", eats: ["rabbit", "squirrel", "mole"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Vulpes_vulpes_ssp_fulvus.jpg?width=640",
    blurb: "Opportunistic omnivore. Hunts at dawn and dusk; will also eat berries and insects."
  },
  {
    id: "mole", name: "Eastern Mole", latin: "Scalopus aquaticus",
    kind: "mammal", env: ["backyard"], climate: ["temperate"],
    trophic: "secondary", eats: ["earthworm"], eatenBy: ["hawk", "fox"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Scalopus_aquaticus_2.jpg?width=640",
    blurb: "Subterranean insectivore. Tunnels constantly; eats roughly its body weight in worms daily."
  },

  // ───────── TERRARIUM ─────────
  {
    id: "moss", name: "Sheet Moss", latin: "Hypnum",
    kind: "plant", env: ["terrarium"], climate: ["temperate", "tropical"],
    trophic: "producer", eats: [], eatenBy: ["springtail"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Hypnum_cupressiforme_%28b%2C_144505-471646%29_8124.jpg?width=640",
    blurb: "Forms a dense green carpet. Holds humidity; thrives in low light."
  },
  {
    id: "fern", name: "Maidenhair Fern", latin: "Adiantum",
    kind: "plant", env: ["terrarium"], climate: ["tropical"],
    trophic: "producer", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Adiantum_capillus-veneris_kz02.jpg?width=640",
    blurb: "Delicate fronds; demands constant humidity. Centerpiece plant."
  },
  {
    id: "springtail", name: "Springtail", latin: "Collembola",
    kind: "invertebrate", env: ["terrarium"], climate: ["temperate", "tropical"],
    trophic: "decomposer", eats: ["moss"], eatenBy: ["dartfrog", "anole"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Springtail_%28Collembola%29.jpg?width=640",
    blurb: "Bioactive cleanup crew. Eats mold and detritus; reproduces fast."
  },
  {
    id: "isopod", name: "Dwarf Isopod", latin: "Trichorhina tomentosa",
    kind: "invertebrate", env: ["terrarium"], climate: ["tropical"],
    trophic: "decomposer", eats: [], eatenBy: ["dartfrog"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Porcellio_scaber_-_Cellar_woodlouse.jpg?width=640",
    blurb: "Detritivore. Breaks down leaf litter; pairs perfectly with springtails."
  },
  {
    id: "dartfrog", name: "Blue Poison Dart Frog", latin: "Dendrobates tinctorius",
    kind: "amphibian", env: ["terrarium"], climate: ["tropical"],
    trophic: "secondary", eats: ["springtail", "isopod"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Dendrobates_azureus_qtl1.jpg?width=640",
    blurb: "Diurnal, vocal, peaceful with own kind. Captive-bred frogs are not toxic."
  },
  {
    id: "anole", name: "Green Anole", latin: "Anolis carolinensis",
    kind: "reptile", env: ["terrarium", "backyard"], climate: ["temperate", "tropical"],
    trophic: "secondary", eats: ["springtail", "caterpillar"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/AnolisCarolinensis.jpg?width=640",
    blurb: "Arboreal lizard. Color-shifts brown↔green. Eats small live insects."
  },
  {
    id: "leopardgecko", name: "Leopard Gecko", latin: "Eublepharis macularius",
    kind: "reptile", env: ["terrarium"], climate: ["arid"],
    trophic: "secondary", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Leopardgecko.jpg?width=640",
    blurb: "Crepuscular desert lizard. Hardy beginner reptile; eats crickets and mealworms."
  },
  {
    id: "succulent", name: "Echeveria", latin: "Echeveria elegans",
    kind: "plant", env: ["terrarium", "backyard"], climate: ["arid"],
    trophic: "producer", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Echeveria_elegans_2.JPG?width=640",
    blurb: "Rosette succulent. Thrives on neglect; perfect for dry terraria."
  },

  // ───────── FRESHWATER AQUARIUM ─────────
  {
    id: "anubias", name: "Anubias", latin: "Anubias barteri",
    kind: "plant", env: ["freshwater"], climate: ["tropical"],
    trophic: "producer", eats: [], eatenBy: ["snail"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Anubias_barteri_var._nana.jpg?width=640",
    blurb: "Tough rhizome plant. Attaches to driftwood; nearly indestructible."
  },
  {
    id: "javafern", name: "Java Fern", latin: "Microsorum pteropus",
    kind: "plant", env: ["freshwater"], climate: ["tropical"],
    trophic: "producer", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Microsorum_pteropus.jpg?width=640",
    blurb: "Epiphyte. Don't bury the rhizome. Slow-growing, undemanding."
  },
  {
    id: "snail", name: "Nerite Snail", latin: "Neritina natalensis",
    kind: "invertebrate", env: ["freshwater"], climate: ["tropical"],
    trophic: "primary", eats: ["anubias"], eatenBy: ["loach"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Vittina_turrita.jpg?width=640",
    blurb: "Algae cleanup crew. Won't reproduce in freshwater. Safe with most fish."
  },
  {
    id: "shrimp", name: "Cherry Shrimp", latin: "Neocaridina davidi",
    kind: "invertebrate", env: ["freshwater"], climate: ["tropical"],
    trophic: "primary", eats: [], eatenBy: ["betta", "angelfish", "loach"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_Cherry_Shrimp.jpg?width=640",
    blurb: "Peaceful detritivore. Breeds readily in planted tanks. Vulnerable to fish predation."
  },
  {
    id: "neon", name: "Neon Tetra", latin: "Paracheirodon innesi",
    kind: "fish", env: ["freshwater"], climate: ["tropical"],
    trophic: "primary", eats: ["shrimp"], eatenBy: ["angelfish", "betta"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Neonsalmler.jpg?width=640",
    blurb: "Schooling fish (6+). Peaceful but tiny — large fish will eat them."
  },
  {
    id: "betta", name: "Betta", latin: "Betta splendens",
    kind: "fish", env: ["freshwater"], climate: ["tropical"],
    trophic: "secondary", eats: ["neon", "shrimp"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Halfmoon_betta_fancy.jpg?width=640",
    blurb: "Solitary. Males will fight each other to death. Eats small tankmates and shrimp."
  },
  {
    id: "angelfish", name: "Angelfish", latin: "Pterophyllum scalare",
    kind: "fish", env: ["freshwater"], climate: ["tropical"],
    trophic: "secondary", eats: ["neon", "shrimp"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Pterophyllum_scalare.JPG?width=640",
    blurb: "Cichlid. Semi-aggressive, will eat anything that fits in its mouth."
  },
  {
    id: "loach", name: "Kuhli Loach", latin: "Pangio kuhlii",
    kind: "fish", env: ["freshwater"], climate: ["tropical"],
    trophic: "secondary", eats: ["snail", "shrimp"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Pangio_kuhlii_2.jpg?width=640",
    blurb: "Eel-like bottom dweller. Nocturnal scavenger; loves substrate cover."
  },
  {
    id: "guppy", name: "Guppy", latin: "Poecilia reticulata",
    kind: "fish", env: ["freshwater"], climate: ["tropical"],
    trophic: "primary", eats: ["shrimp"], eatenBy: ["angelfish", "betta"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Guppy.male.-.cropped.jpg?width=640",
    blurb: "Livebearer. Reproduces prolifically; males very colorful, females plain."
  },

  // ───────── SALTWATER / REEF ─────────
  {
    id: "coral", name: "Hammer Coral", latin: "Euphyllia ancora",
    kind: "invertebrate", env: ["saltwater"], climate: ["tropical"],
    trophic: "producer", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Anchor_Coral.jpg?width=640",
    blurb: "LPS coral. Sweeper tentacles will sting nearby corals. Symbiotic with zooxanthellae."
  },
  {
    id: "anemone", name: "Bubble-tip Anemone", latin: "Entacmaea quadricolor",
    kind: "invertebrate", env: ["saltwater"], climate: ["tropical"],
    trophic: "secondary", eats: [], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Bubble_Tip_Anemone_in_Maui.jpg?width=640",
    blurb: "Hosts clownfish symbiotically. Will sting and eat any fish that isn't its partner."
  },
  {
    id: "clownfish", name: "Ocellaris Clownfish", latin: "Amphiprion ocellaris",
    kind: "fish", env: ["saltwater"], climate: ["tropical"],
    trophic: "secondary", eats: [], eatenBy: ["lionfish"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Amphiprion_ocellaris_%28Clown_anemonefish%29_in_Heteractis_magnifica_%28Sea_anemone%29.jpg?width=640",
    blurb: "Mutualist with anemones. Hardy reef beginner; pairs bond for life."
  },
  {
    id: "tang", name: "Yellow Tang", latin: "Zebrasoma flavescens",
    kind: "fish", env: ["saltwater"], climate: ["tropical"],
    trophic: "primary", eats: [], eatenBy: ["lionfish"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Zebrasoma_flavescens_Luc_Viatour.jpg?width=640",
    blurb: "Algae grazer. Needs swimming room (75gal+). Aggressive to other tangs."
  },
  {
    id: "cleanershrimp", name: "Cleaner Shrimp", latin: "Lysmata amboinensis",
    kind: "invertebrate", env: ["saltwater"], climate: ["tropical"],
    trophic: "secondary", eats: [], eatenBy: ["lionfish"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Lysmata_amboinensis_%28Scarlet_cleaner_shrimp%29.jpg?width=640",
    blurb: "Picks parasites off fish at cleaning stations. Reef-safe; peaceful."
  },
  {
    id: "lionfish", name: "Lionfish", latin: "Pterois volitans",
    kind: "fish", env: ["saltwater"], climate: ["tropical"],
    trophic: "tertiary", eats: ["clownfish", "tang", "cleanershrimp"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Pterois_volitans_Manado-e_edit.jpg?width=640",
    blurb: "Venomous predator. Eats anything that fits in its mouth. Don't mix with peaceful fish."
  },

  // ───────── POND ─────────
  {
    id: "lily", name: "Water Lily", latin: "Nymphaea odorata",
    kind: "plant", env: ["pond"], climate: ["temperate", "tropical"],
    trophic: "producer", eats: [], eatenBy: ["koi"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Nymphaea_odorata_Arkansas.jpg?width=640",
    blurb: "Floating-leaf plant. Shades the water; lowers algae. Roots in pond bottom."
  },
  {
    id: "duckweed", name: "Duckweed", latin: "Lemna minor",
    kind: "plant", env: ["pond", "freshwater"], climate: ["temperate", "tropical"],
    trophic: "producer", eats: [], eatenBy: ["koi", "goldfish"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Lemna_minor_NRM.jpg?width=640",
    blurb: "Tiny floating plant. Doubles in days; useful nitrate sponge but can take over."
  },
  {
    id: "tadpole", name: "Bullfrog Tadpole", latin: "Lithobates catesbeianus",
    kind: "amphibian", env: ["pond"], climate: ["temperate"],
    trophic: "primary", eats: ["duckweed"], eatenBy: ["heron", "koi"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Bullfrog_-_natures_pics.jpg?width=640",
    blurb: "Larval frog. Algae grazer; takes 1–2 years to metamorphose into a bullfrog."
  },
  {
    id: "koi", name: "Koi", latin: "Cyprinus rubrofuscus",
    kind: "fish", env: ["pond"], climate: ["temperate"],
    trophic: "primary", eats: ["lily", "duckweed", "tadpole"], eatenBy: ["heron"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Showa_koi.jpg?width=640",
    blurb: "Long-lived ornamental carp. Outgrow most ponds; need 1000+ gallons."
  },
  {
    id: "goldfish", name: "Goldfish", latin: "Carassius auratus",
    kind: "fish", env: ["pond", "freshwater"], climate: ["temperate"],
    trophic: "primary", eats: ["duckweed"], eatenBy: ["heron"],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/Common_goldfish.JPG?width=640",
    blurb: "Cold-tolerant. Often outgrows aquariums; better suited to ponds."
  },
  {
    id: "heron", name: "Great Blue Heron", latin: "Ardea herodias",
    kind: "bird", env: ["pond"], climate: ["temperate"],
    trophic: "tertiary", eats: ["koi", "goldfish", "tadpole"], eatenBy: [],
    img: "https://commons.wikimedia.org/wiki/Special:FilePath/GBHfish5.jpg?width=640",
    blurb: "Patient stalker. Will empty an unprotected pond. Use netting or shelter."
  }
];

// Replace remote URLs with on-brand SVG placeholders so images always load.
SPECIES.forEach((s, i) => { s.img = window.makePlaceholder(s, i); });

window.SPECIES = SPECIES;
window.SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
