import NavigationLayer from "./NavigationLayer";
import SearchLayer from "./SearchLayer";
import BulgariaMapLayer from "./BulgariaMapLayer";
import CityCardsLayer from "./CityCardsLayer";
import SeaMotion from "./SeaMotion";
export default function HomePage({ catalog = null } = {}) {
  return (
    <main className="home-artboard" aria-label="Недвижими имоти Надежда">
      <img
        className="locked-base"
        src="/assets/HOME_WORKING_PIXEL_LOCK.png"
        alt=""
        draggable="false"
      />
      <SeaMotion />
      <NavigationLayer />
      <SearchLayer catalog={catalog} />
      <BulgariaMapLayer catalog={catalog} />
      <CityCardsLayer catalog={catalog} />
    </main>
  );
}
