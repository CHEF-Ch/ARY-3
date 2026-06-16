import { useParams } from "react-router-dom";
export default function RacePage() {
  const { slug } = useParams();
  return <div><h1>Race: {slug}</h1><p>Race Page — to be implemented (B: race-mgmt)</p></div>;
}
