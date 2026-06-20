import { useParams } from "react-router-dom";
export default function RiderPage() {
  const { slug } = useParams();
  return <div><h1>Rider: {slug}</h1><p>Rider Profile — to be implemented (A: communication)</p></div>;
}
