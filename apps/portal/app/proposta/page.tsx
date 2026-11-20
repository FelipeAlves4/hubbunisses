import PropostaPage from "../../../proposta-plus/app/(protected)/page";
import { getOptionalApplicationAccess } from "../../lib/application-access";

export default async function PortalPropostaPage() {
  const access = await getOptionalApplicationAccess("opera-plus");
  return <PropostaPage hubHref="/" operationsHref={access ? "/operacoes" : undefined} />;
}
