import { useParams } from "react-router-dom";
export default function LivePage() {
  const { slug } = useParams();
  return <div><h1>Live Hall: {slug}</h1><p>Live Hall — to be implemented (D: projection)</p></div>;
}
