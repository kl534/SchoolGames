/**
 * Common kid words for typing blocks: lowercase a to z, 2 to 7 letters, each once. Sight words and
 * simple nouns, verbs and adjectives, with plenty that use only the early keys.
 */
export const WORDS: string[] = `
as is if he she has had said like side fish dish kids lake hide hike sale glad leg life lid file
fig egg seed feel jade shell sled ask all sad dad fall hall shall flag dash
see she her hers hen held help hill hid hit his hide hire lie lies lid lead leaf lake lane late
eel eels else idea ideal gift girl give glide glass gold good grade green grew grid
fed fee fire first fist five fix flies fill find fine fits flake flies free fresh fed
did die dig dine dire disk dive dies dress drill drive deer deed dike died
ease easy edge eight elk elf end ends every evil eye eyes
ice icy ill inch inside idle isle
keg key keep kept kid kill kind king kiss kite kiss kick
led leg legs less let lift like lime line link lip list live lies lids lock
age ago air aim all and any are arm art ate
bad bag ball band bank bark barn base bath bat beach bean bear beat bed bee bell belt bend best
bet big bike bill bird bit bite black blue boat body bone book boot born both bowl box boy bread
bring brown bug bus but buy
cab cake call came camp can cap car card care cart cat catch cave chair chip city clap class
clay clean clock close cloud coat cold come cook cool corn cost cow crab crew crop cry cub cup
cut
dance dark day deep deer desk dog doll door down draw dream drop drum dry duck dust
each ear earth eat egg
face fact fair farm fast fat fear feet fern film fox frog from fruit full fun fur
game gate gave get gift goat going grab grass gray great grow gum gym
hair hand hang happy hard hat have hay head hear heart heat hen here high hold home hop horse
hot house how hug hum hunt hurt
jam jar jaw jazz jet job jog join joke joy juice jump just
keep kick kind kite knee knit know
lamp land last lay lazy leap left lend lick lion lip lost loud love luck lunch
mad made mail make man many map mark mask mat may meal meat meet melt men mess milk mind miss
mix mom moon more most mouse move mud mug must
nap near neck nest net never new next nice night nine nod noon nose note now nut
oak oar odd off oil old once one only open orange our out oven over owl own
pack page paid pail pair pan park part pass pat paw pay pea peel pen pet pick pie pig pin pink
pit plan plant play plum pod pond pony pool pop pot pull pup push put
quack queen quick quiet quilt quit quiz
race rain ran rat read real red rest rice rich ride ring road rock roll roof room root rope rose
rub rug run rush
sack safe sail salt same sand sat save saw say seal sea seat see seem sell send set sew shake
shape sheep ship shoe shop show sick sing sink sit six skin sky sleep slide slow small smile snow
soap sock soft song soon sound soup spin sport star stay step stop sun swim
tail take talk tall tap tea team tell ten tent test than thank that then they thin this three
tie time tin tip toad toe told too took top town toy tree trip truck try tub turn two
under until up use
van vase very vest view vine visit voice vote
wag wait wake walk wall want warm wash watch water wave way web week well went wet whale what
wheel when white wide wild will win wind wing wish with wolf wood word work worm wrap
yak yard yarn year yell yes yet yoga yolk you young
zero zip zoo zoom
`
  .split(/\s+/)
  .filter(Boolean)
  .filter((word, i, all) => all.indexOf(word) === i);
