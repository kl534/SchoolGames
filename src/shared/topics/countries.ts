export type Continent =
  'north-america' | 'south-america' | 'europe' | 'africa' | 'asia' | 'oceania';

export interface Country {
  /** Shown name and answer, 'United Kingdom'. */
  name: string;
  /** Said in lines, when not `name`: 'the United Kingdom'. */
  spoken?: string;
  continent: Continent;
  /** ISO 3166-1 numeric code, as world-atlas feature ids ('076' for Brazil). */
  iso: string;
}

const c = (name: string, continent: Continent, iso: string, spoken?: string): Country =>
  spoken ? { name, spoken, continent, iso } : { name, continent, iso };

/** The 60 countries of Find the country, grouped by continent. */
export const COUNTRIES: Country[] = [
  c('Canada', 'north-america', '124'),
  c('United States', 'north-america', '840', 'the United States'),
  c('Mexico', 'north-america', '484'),
  c('Guatemala', 'north-america', '320'),
  c('Honduras', 'north-america', '340'),
  c('Nicaragua', 'north-america', '558'),
  c('Costa Rica', 'north-america', '188'),
  c('Panama', 'north-america', '591'),
  c('Cuba', 'north-america', '192'),
  c('Jamaica', 'north-america', '388'),
  c('Brazil', 'south-america', '076'),
  c('Argentina', 'south-america', '032'),
  c('Chile', 'south-america', '152'),
  c('Peru', 'south-america', '604'),
  c('Colombia', 'south-america', '170'),
  c('Venezuela', 'south-america', '862'),
  c('Ecuador', 'south-america', '218'),
  c('Bolivia', 'south-america', '068'),
  c('Paraguay', 'south-america', '600'),
  c('Uruguay', 'south-america', '858'),
  c('United Kingdom', 'europe', '826', 'the United Kingdom'),
  c('Ireland', 'europe', '372'),
  c('Iceland', 'europe', '352'),
  c('Norway', 'europe', '578'),
  c('Sweden', 'europe', '752'),
  c('France', 'europe', '250'),
  c('Spain', 'europe', '724'),
  c('Portugal', 'europe', '620'),
  c('Germany', 'europe', '276'),
  c('Switzerland', 'europe', '756'),
  c('Italy', 'europe', '380'),
  c('Poland', 'europe', '616'),
  c('Greece', 'europe', '300'),
  c('Ukraine', 'europe', '804'),
  c('Egypt', 'africa', '818'),
  c('Morocco', 'africa', '504'),
  c('Algeria', 'africa', '012'),
  c('Nigeria', 'africa', '566'),
  c('Ghana', 'africa', '288'),
  c('Ethiopia', 'africa', '231'),
  c('Kenya', 'africa', '404'),
  c('Tanzania', 'africa', '834'),
  c('South Africa', 'africa', '710'),
  c('Madagascar', 'africa', '450'),
  c('Russia', 'asia', '643'),
  c('Turkey', 'asia', '792'),
  c('Saudi Arabia', 'asia', '682'),
  c('Iran', 'asia', '364'),
  c('India', 'asia', '356'),
  c('China', 'asia', '156'),
  c('Japan', 'asia', '392'),
  c('South Korea', 'asia', '410'),
  c('Thailand', 'asia', '764'),
  c('Vietnam', 'asia', '704'),
  c('Indonesia', 'asia', '360'),
  c('Philippines', 'asia', '608', 'the Philippines'),
  c('Australia', 'oceania', '036'),
  c('New Zealand', 'oceania', '554'),
  c('Papua New Guinea', 'oceania', '598'),
  c('Fiji', 'oceania', '242'),
];

export const CONTINENT_TITLES: Record<Continent, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};
