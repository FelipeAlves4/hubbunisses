"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArchiveRestore,
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Calculator,
  CircleAlert,
  CircleHelp,
  Copy,
  Download,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  calculatePricingScenarios,
  calculateProductPrice,
  calculateServicePrice,
  PricingInputError,
  type PricingResult,
  type ProductPricingInput,
  type ServicePricingInput,
} from "@asex/pricing";
import { Button, Field, NumberInput, StatusMessage } from "@asex/ui";
import {
  CompanyProfileError,
  companyProfileRepository,
  type CompanyProfile,
} from "../lib/company-profile";
import { buildPricingReportData } from "../lib/report-data";
import {
  simulationRepository,
  SimulationStorageError,
  type SimulationRepository,
  type PricingSimulation,
  type SavedScenario,
  type SimulationInput,
  type SimulationKind,
} from "../lib/simulation-repository";
import { SupabaseSimulationRepository } from "../lib/supabase-simulation-repository";
import { createClient } from "../lib/supabase/browser";
import { isSupabaseConfigured, portalUrl } from "../lib/supabase/config";

type View = "calculator" | "history" | "reports";
type ProductForm = Record<keyof ProductPricingInput, string>;
type ServiceForm = Record<keyof ServicePricingInput, string>;
type Result = PricingResult & { laborCost?: number };

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const initialProduct: ProductForm = {
  name: "",
  acquisitionCost: "",
  packagingCost: "",
  freightPerUnit: "",
  otherDirectCosts: "",
  fixedExpensePerUnit: "",
  commissionRate: "",
  taxRate: "",
  paymentFeeRate: "",
  desiredMarginRate: "",
};
const initialService: ServiceForm = {
  name: "",
  description: "",
  category: "",
  estimatedHours: "",
  hourlyCost: "",
  professionalCount: "1",
  materialsCost: "",
  travelCost: "",
  outsourcingCost: "",
  otherDirectCosts: "",
  fixedExpenseAllocated: "",
  commissionRate: "",
  taxRate: "",
  paymentFeeRate: "",
  desiredMarginRate: "",
};
const productFields: Array<{
  key: Exclude<keyof ProductPricingInput, "name">;
  label: string;
  unit: "R$" | "%";
}> = [
  { key: "acquisitionCost", label: "Custo de aquisição", unit: "R$" },
  { key: "packagingCost", label: "Embalagem", unit: "R$" },
  { key: "freightPerUnit", label: "Frete por unidade", unit: "R$" },
  { key: "otherDirectCosts", label: "Outros custos diretos", unit: "R$" },
  { key: "fixedExpensePerUnit", label: "Despesas fixas alocadas", unit: "R$" },
  { key: "commissionRate", label: "Comissões", unit: "%" },
  { key: "taxRate", label: "Tributos", unit: "%" },
  { key: "paymentFeeRate", label: "Taxas de pagamento", unit: "%" },
  { key: "desiredMarginRate", label: "Margem desejada", unit: "%" },
];
const serviceCostFields: Array<{
  key:
    | "estimatedHours"
    | "hourlyCost"
    | "professionalCount"
    | "materialsCost"
    | "travelCost"
    | "outsourcingCost"
    | "otherDirectCosts"
    | "fixedExpenseAllocated";
  label: string;
  unit: "R$" | "h" | "pessoas";
}> = [
  { key: "estimatedHours", label: "Horas estimadas", unit: "h" },
  { key: "hourlyCost", label: "Custo por hora", unit: "R$" },
  { key: "professionalCount", label: "Profissionais", unit: "pessoas" },
  { key: "materialsCost", label: "Materiais e insumos", unit: "R$" },
  { key: "travelCost", label: "Deslocamento", unit: "R$" },
  { key: "outsourcingCost", label: "Terceirizações", unit: "R$" },
  { key: "otherDirectCosts", label: "Outros custos diretos", unit: "R$" },
  {
    key: "fixedExpenseAllocated",
    label: "Despesas fixas alocadas",
    unit: "R$",
  },
];
const rateFields: Array<{
  key: "commissionRate" | "taxRate" | "paymentFeeRate" | "desiredMarginRate";
  label: string;
}> = [
  { key: "commissionRate", label: "Comissões" },
  { key: "taxRate", label: "Tributos" },
  { key: "paymentFeeRate", label: "Taxas de pagamento" },
  { key: "desiredMarginRate", label: "Margem desejada" },
];

function numeric(value: string) {
  return Number(value || 0);
}
function toProductInput(form: ProductForm): ProductPricingInput {
  return {
    name: form.name.trim(),
    acquisitionCost: numeric(form.acquisitionCost),
    packagingCost: numeric(form.packagingCost),
    freightPerUnit: numeric(form.freightPerUnit),
    otherDirectCosts: numeric(form.otherDirectCosts),
    fixedExpensePerUnit: numeric(form.fixedExpensePerUnit),
    commissionRate: numeric(form.commissionRate) / 100,
    taxRate: numeric(form.taxRate) / 100,
    paymentFeeRate: numeric(form.paymentFeeRate) / 100,
    desiredMarginRate: numeric(form.desiredMarginRate) / 100,
  };
}
function toServiceInput(form: ServiceForm): ServicePricingInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    category: form.category.trim() || undefined,
    estimatedHours: numeric(form.estimatedHours),
    hourlyCost: numeric(form.hourlyCost),
    professionalCount: numeric(form.professionalCount),
    materialsCost: numeric(form.materialsCost),
    travelCost: numeric(form.travelCost),
    outsourcingCost: numeric(form.outsourcingCost),
    otherDirectCosts: numeric(form.otherDirectCosts),
    fixedExpenseAllocated: numeric(form.fixedExpenseAllocated),
    commissionRate: numeric(form.commissionRate) / 100,
    taxRate: numeric(form.taxRate) / 100,
    paymentFeeRate: numeric(form.paymentFeeRate) / 100,
    desiredMarginRate: numeric(form.desiredMarginRate) / 100,
  };
}
function productToForm(input: ProductPricingInput): ProductForm {
  return {
    ...Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "number" && key.endsWith("Rate")
          ? String(value * 100)
          : String(value),
      ]),
    ),
  } as ProductForm;
}
function serviceToForm(input: ServicePricingInput): ServiceForm {
  return {
    ...Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "number" && key.endsWith("Rate")
          ? String(value * 100)
          : String(value ?? ""),
      ]),
    ),
  } as ServiceForm;
}
function inputFor(
  kind: SimulationKind,
  product: ProductForm,
  service: ServiceForm,
): SimulationInput {
  return kind === "product" ? toProductInput(product) : toServiceInput(service);
}
function calculate(kind: SimulationKind, input: SimulationInput): Result {
  return kind === "product"
    ? calculateProductPrice(input as ProductPricingInput)
    : calculateServicePrice(input as ServicePricingInput);
}
function toScenarioSaved(values: SavedScenario) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as SavedScenario;
}

function MeasureField({
  id,
  label,
  value,
  unit,
  onChange,
  hint,
  minimum = 0,
}: {
  id: string;
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  hint?: string;
  minimum?: number;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <div className="measure-input">
        <span>{unit}</span>
        <NumberInput
          id={id}
          min={minimum}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0,00"
          aria-label={`${label} em ${unit}`}
        />
      </div>
    </Field>
  );
}
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="history-empty">
      <History size={30} />
      <h2>Nenhuma simulação salva</h2>
      <p>
        Quando um cálculo estiver pronto, salve-o para recuperar e revisar as
        premissas depois.
      </p>
      <Button onClick={onNew}>
        <Plus size={16} /> Nova simulação
      </Button>
    </div>
  );
}
function ResultPanel({
  result,
  name,
}: {
  result: Result | null;
  name: string;
}) {
  const composition =
    result?.composition.filter((part) => part.amount > 0) ?? [];
  const rows = result
    ? [
        ["Custo total", BRL.format(result.totalCost)],
        ["Preço de equilíbrio", BRL.format(result.priceFloor)],
        ["Lucro estimado", BRL.format(result.grossProfitPerUnit)],
        ["Margem sobre receita", percent.format(result.estimatedMarginRate)],
        ["Markup", `${result.markup.toFixed(2)}x`],
      ]
    : [];
  return (
    <aside className="result-panel" aria-live="polite">
      <div className="result-title">
        <span>Resultado da simulação</span>
        <h2>Preço recomendado</h2>
        <strong>{result ? BRL.format(result.recommendedPrice) : "—"}</strong>
        <p>
          {result
            ? `${name || "Esta simulação"} considera as premissas informadas.`
            : "Preencha os dados para calcular com segurança."}
        </p>
      </div>
      {result ? (
        <>
          <dl className="result-list">
            {rows.map(([label, value], index) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={index === 2 ? "profit" : ""}>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="composition" aria-labelledby="composition-title">
            <h3 id="composition-title">Composição do custo</h3>
            <div className="composition-bar">
              {composition.map((part) => (
                <i
                  key={part.label}
                  style={{
                    width: `${(part.amount / result.totalCost) * 100}%`,
                  }}
                />
              ))}
            </div>
            <ul>
              {composition.map((part) => (
                <li key={part.label}>
                  <span>{part.label}</span>
                  <strong>{BRL.format(part.amount)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="empty-result">
          <Calculator size={24} />
          <p>
            Os resultados são calculados somente com os valores que você
            informar.
          </p>
        </div>
      )}
      <p className="tax-note">
        <CircleHelp size={15} /> A margem é calculada sobre a receita. Esta
        simulação não substitui orientação contábil ou tributária.
      </p>
    </aside>
  );
}
function ScenarioValues({ values }: { values: string[][] }) {
  return (
    <dl className="scenario-values">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function ScenarioSimulator({
  result,
  desiredMarginRate,
  values,
  onChange,
}: {
  result: Result;
  desiredMarginRate: number;
  values: SavedScenario;
  onChange: (next: SavedScenario) => void;
}) {
  const calculation = useMemo(() => {
    try {
      return {
        scenarios: calculatePricingScenarios({
          totalCost: result.totalCost,
          variableRate: result.variableRate,
          desiredMarginRate,
          recommendedPrice: result.recommendedPrice,
          ...values,
        }),
        error: "",
      };
    } catch (error) {
      return {
        scenarios: {},
        error:
          error instanceof PricingInputError
            ? error.message
            : "Revise os valores do cenário.",
      };
    }
  }, [result, desiredMarginRate, values]);
  const { scenarios } = calculation;
  const warnings = [scenarios.customSale, scenarios.discount]
    .filter(Boolean)
    .flatMap((item) =>
      !item
        ? []
        : item.profit < 0
          ? ["O cenário gera prejuízo."]
          : item.differenceFromBalance < 0
            ? ["O preço fica abaixo do ponto de equilíbrio."]
            : item.effectiveMarginRate < desiredMarginRate
              ? ["A margem fica abaixo da margem desejada."]
              : [],
    );
  const read = (key: keyof SavedScenario) =>
    values[key] === undefined
      ? ""
      : key === "customPrice"
        ? String(values[key])
        : String((values[key] ?? 0) * 100);
  const set = (key: keyof SavedScenario, raw: string) =>
    onChange({
      ...values,
      [key]:
        raw === ""
          ? undefined
          : key === "customPrice"
            ? numeric(raw)
            : numeric(raw) / 100,
    });
  return (
    <section className="scenario-section" aria-labelledby="scenario-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <TrendingUp size={15} /> Simulação de cenários
          </span>
          <h2 id="scenario-title">Teste decisões antes de fechar</h2>
          <p>
            Compare cada hipótese com o preço recomendado e o ponto de
            equilíbrio.
          </p>
        </div>
        <button
          type="button"
          className="scenario-reset"
          onClick={() => onChange({})}
        >
          <RotateCcw size={15} />
          Limpar
        </button>
      </div>
      <div className="scenario-grid">
        <article className="scenario-card">
          <BadgeDollarSign size={20} />
          <h3>Preço personalizado</h3>
          <p>Veja o resultado com o valor que pretende cobrar.</p>
          <MeasureField
            id="custom-price"
            label="Preço de venda"
            value={read("customPrice")}
            unit="R$"
            onChange={(value) => set("customPrice", value)}
          />
          {scenarios.customSale ? (
            <ScenarioValues
              values={[
                ["Lucro", BRL.format(scenarios.customSale.profit)],
                [
                  "Margem efetiva",
                  percent.format(scenarios.customSale.effectiveMarginRate),
                ],
                [
                  "Vs. sugerido",
                  BRL.format(scenarios.customSale.differenceFromSuggested),
                ],
              ]}
            />
          ) : null}
        </article>
        <article className="scenario-card">
          <Tag size={20} />
          <h3>Desconto</h3>
          <p>Entenda o impacto de uma negociação no lucro.</p>
          <MeasureField
            id="discount"
            label="Desconto"
            value={read("discountRate")}
            unit="%"
            onChange={(value) => set("discountRate", value)}
          />
          {scenarios.discount ? (
            <ScenarioValues
              values={[
                ["Preço com desconto", BRL.format(scenarios.discount.price)],
                ["Lucro restante", BRL.format(scenarios.discount.profit)],
                [
                  "Redução de lucro",
                  BRL.format(scenarios.discount.profitReduction),
                ],
              ]}
            />
          ) : null}
        </article>
        <article className="scenario-card">
          <ReceiptText size={20} />
          <h3>Variação de custo</h3>
          <p>Projete aumento ou redução dos seus custos.</p>
          <MeasureField
            id="cost-variation"
            label="Variação de custo"
            value={read("costVariationRate")}
            unit="%"
            minimum={-99}
            onChange={(value) => set("costVariationRate", value)}
          />
          {scenarios.costVariation ? (
            <ScenarioValues
              values={[
                [
                  "Novo custo",
                  BRL.format(scenarios.costVariation.newTotalCost),
                ],
                [
                  "Margem atual",
                  percent.format(scenarios.costVariation.effectiveMarginRate),
                ],
                [
                  "Preço para a meta",
                  BRL.format(scenarios.costVariation.requiredPrice),
                ],
              ]}
            />
          ) : null}
        </article>
      </div>
      {calculation.error ? (
        <div className="scenario-warning" role="alert">
          <CircleAlert size={18} />
          {calculation.error}
        </div>
      ) : null}
      {warnings.length ? (
        <div className="scenario-warning" role="status">
          <CircleAlert size={18} />
          {[...new Set(warnings)].join(" ")}
        </div>
      ) : null}
    </section>
  );
}

export default function PrecificaPage() {
  const [repository, setRepository] =
    useState<SimulationRepository>(simulationRepository);
  const [storageMode, setStorageMode] = useState<"local" | "cloud">("local");
  const [localImportCount, setLocalImportCount] = useState<number | null>(null);
  const [confirmLocalImport, setConfirmLocalImport] = useState(false);
  const [view, setView] = useState<View>("calculator");
  const [kind, setKind] = useState<SimulationKind>("product");
  const [product, setProduct] = useState(initialProduct);
  const [service, setService] = useState(initialService);
  const [result, setResult] = useState<Result | null>(null);
  const [scenarios, setScenarios] = useState<SavedScenario>({});
  const [referenceName, setReferenceName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<PricingSimulation[]>([]);
  const [company, setCompany] = useState<CompanyProfile>({ legalName: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | SimulationKind>("all");
  const [pendingDelete, setPendingDelete] = useState<PricingSimulation | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const activeName = kind === "product" ? product.name : service.name;
  const activeMargin =
    kind === "product"
      ? numeric(product.desiredMarginRate) / 100
      : numeric(service.desiredMarginRate) / 100;
  const calculatedScenarios = useMemo(() => {
    if (!result) return {};
    try {
      return calculatePricingScenarios({
        totalCost: result.totalCost,
        variableRate: result.variableRate,
        desiredMarginRate: activeMargin,
        recommendedPrice: result.recommendedPrice,
        ...scenarios,
      });
    } catch {
      return {};
    }
  }, [result, activeMargin, scenarios]);
  const refresh = async () => {
    try {
      setSimulations(await repository.list());
      setHistoryError("");
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as simulações.",
      );
    }
  };
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const connect = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;
      if (!userId) {
        window.location.assign(
          `${portalUrl}/login?next=${encodeURIComponent(window.location.href)}`,
        );
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        window.location.assign(`${portalUrl}/onboarding`);
        return;
      }
      if (active) {
        setRepository(
          new SupabaseSimulationRepository(
            supabase,
            membership.organization_id,
          ),
        );
        setStorageMode("cloud");
      }
    };
    void connect();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    void refresh();
    companyProfileRepository
      .get()
      .then(setCompany)
      .catch((cause: unknown) =>
        setHistoryError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar dados de relatórios.",
        ),
      );
  }, [repository]);
  useEffect(() => {
    if (storageMode !== "cloud") return;
    simulationRepository
      .list()
      .then((items) => setLocalImportCount(items.length))
      .catch(() => setLocalImportCount(null));
  }, [storageMode]);
  const switchView = (next: View) => {
    if (next !== "calculator" && dirty) {
      setPendingView(next);
      return;
    }
    setView(next);
  };
  const updateProduct = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K],
  ) => {
    setProduct((old) => ({ ...old, [key]: value }));
    setResult(null);
    setDirty(true);
  };
  const updateService = <K extends keyof ServiceForm>(
    key: K,
    value: ServiceForm[K],
  ) => {
    setService((old) => ({ ...old, [key]: value }));
    setResult(null);
    setDirty(true);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const input = inputFor(kind, product, service);
    if (!input.name) {
      setError(
        `Informe o nome ${kind === "product" ? "do produto" : "do serviço"} para continuar.`,
      );
      document.getElementById("name")?.focus();
      return;
    }
    try {
      setResult(calculate(kind, input));
      setReferenceName((old) => old || input.name);
      setStatus("Simulação atualizada com as premissas informadas.");
      setDirty(true);
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof PricingInputError
          ? cause.message
          : "Não foi possível calcular o preço.",
      );
    }
  };
  const newSimulation = () => {
    setKind("product");
    setProduct(initialProduct);
    setService(initialService);
    setResult(null);
    setScenarios({});
    setReferenceName("");
    setEditingId(null);
    setDirty(false);
    setError("");
    setStatus("");
    setView("calculator");
  };
  const saveSimulation = async () => {
    if (!result) return;
    const input = inputFor(kind, product, service);
    const name = referenceName.trim() || input.name;
    if (!name) {
      setError("Informe um nome para salvar esta simulação.");
      return;
    }
    try {
      const payload = {
        name,
        kind,
        input,
        scenarios: toScenarioSaved(scenarios),
      };
      const stored = editingId
        ? await repository.update(editingId, payload)
        : await repository.create(payload);
      setEditingId(stored.id);
      setReferenceName(stored.name);
      setDirty(false);
      setStatus(
        editingId
          ? `Alterações salvas ${storageMode === "cloud" ? "na organização" : "neste navegador"}.`
          : `Simulação salva ${storageMode === "cloud" ? "na organização" : "neste navegador"}.`,
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a simulação.",
      );
    }
  };
  const openSimulation = (item: PricingSimulation) => {
    try {
      const nextResult = calculate(item.kind, item.input);
      setKind(item.kind);
      item.kind === "product"
        ? setProduct(productToForm(item.input as ProductPricingInput))
        : setService(serviceToForm(item.input as ServicePricingInput));
      setResult(nextResult);
      setScenarios(item.scenarios ?? {});
      setReferenceName(item.name);
      setEditingId(item.id);
      setDirty(false);
      setView("calculator");
      setStatus(
        "Simulação recuperada. Os resultados foram recalculados com o modelo compatível.",
      );
    } catch {
      setHistoryError(
        "Esta simulação não é compatível com o modelo de cálculo atual.",
      );
    }
  };
  const duplicateSimulation = async (item: PricingSimulation) => {
    try {
      const copy = await repository.duplicate(item.id);
      await refresh();
      setStatus("Cópia criada nas suas simulações.");
      openSimulation(copy);
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível duplicar a simulação.",
      );
    }
  };
  const removeSimulation = async () => {
    if (!pendingDelete) return;
    try {
      await repository.delete(pendingDelete.id);
      if (editingId === pendingDelete.id) {
        setEditingId(null);
        setDirty(true);
      }
      setPendingDelete(null);
      setStatus(
        `Simulação excluída ${storageMode === "cloud" ? "da organização" : "deste navegador"}.`,
      );
      await refresh();
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível excluir a simulação.",
      );
    }
  };
  const exportBackup = async () => {
    try {
      const backup = await repository.exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "precifica-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Backup JSON preparado para download.");
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível exportar o backup.",
      );
    }
  };
  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const count = await repository.importBackup(await file.text());
      await refresh();
      setStatus(
        `${count} simulação(ões) ${storageMode === "cloud" ? "importada(s) para a organização" : "restaurada(s) neste navegador"}.`,
      );
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível importar o backup.",
      );
    }
  };
  const importLocalHistory = async () => {
    try {
      const backup = await simulationRepository.exportBackup();
      const count = await repository.importBackup(JSON.stringify(backup));
      setConfirmLocalImport(false);
      setLocalImportCount(0);
      setStatus(
        `${count} simulação(ões) importada(s). O histórico deste navegador foi preservado.`,
      );
      await refresh();
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível importar o histórico local.",
      );
    }
  };
  const saveCompany = async () => {
    try {
      await companyProfileRepository.save(company);
      setStatus("Dados para relatórios salvos neste navegador.");
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar os dados de relatórios.",
      );
    }
  };
  const chooseLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const logoDataUrl = await companyProfileRepository.logoFromFile(file);
      setCompany((old) => ({ ...old, logoDataUrl }));
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível usar esse logotipo.",
      );
    }
  };
  const exportPdf = async () => {
    if (!result) return;
    setBusyPdf(true);
    try {
      const { downloadPricingReport } = await import("../lib/pricing-report");
      const input = inputFor(kind, product, service);
      const data = buildPricingReportData({
        referenceName: referenceName || input.name,
        kind,
        input,
        result,
        scenarios: calculatedScenarios,
        scenarioValues: scenarios,
        company,
      });
      await downloadPricingReport(
        data,
        `relatorio-precificacao-${(referenceName || input.name || "asex").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`,
      );
      setStatus("Relatório PDF preparado para download.");
    } catch {
      setError("Não foi possível gerar o relatório PDF. Tente novamente.");
    } finally {
      setBusyPdf(false);
    }
  };
  const filtered = simulations
    .filter(
      (item) =>
        (filter === "all" || item.kind === filter) &&
        item.name
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    )
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <main className="pricing-shell">
      <aside className="pricing-rail" aria-label="Navegação do PRECIFICA+">
        <a className="pricing-brand" href="http://localhost:3000">
          PRECIFICA<span>+</span>
        </a>
        <nav>
          <button
            className={view === "calculator" ? "current" : ""}
            onClick={() => switchView("calculator")}
          >
            <Calculator size={18} />
            Calculadora
          </button>
          <button
            className={view === "history" ? "current" : ""}
            onClick={() => switchView("history")}
          >
            <History size={18} />
            Minhas simulações
          </button>
          <button
            className={view === "reports" ? "current" : ""}
            onClick={() => switchView("reports")}
          >
            <Settings2 size={18} />
            Dados para relatórios
          </button>
        </nav>
        <p className="local-notice">
          <ArchiveRestore size={15} /> Suas simulações estão salvas neste
          navegador. Elas ainda não são sincronizadas entre dispositivos.
        </p>
      </aside>
      <section className="pricing-content">
        {view === "calculator" ? (
          <>
            <header className="pricing-header">
              <p className="product-label">PRECIFICA+ · Precificação</p>
              <h1>Preço seguro para cada decisão</h1>
              <p>
                Calcule produtos e serviços com custos, taxas e margem sobre a
                receita.
              </p>
            </header>
            <div
              className="mode-switch"
              role="tablist"
              aria-label="Tipo de precificação"
            >
              <button
                role="tab"
                aria-selected={kind === "product"}
                className={kind === "product" ? "active" : ""}
                onClick={() => {
                  setKind("product");
                  setResult(null);
                  setDirty(true);
                }}
              >
                <Package size={18} />
                Produto
              </button>
              <button
                role="tab"
                aria-selected={kind === "service"}
                className={kind === "service" ? "active" : ""}
                onClick={() => {
                  setKind("service");
                  setResult(null);
                  setDirty(true);
                }}
              >
                <BriefcaseBusiness size={18} />
                Serviço
              </button>
            </div>
            <div className="calculator-grid">
              <form className="pricing-form" noValidate onSubmit={submit}>
                <div className="form-heading">
                  <h2>
                    {kind === "product"
                      ? "Premissas do produto"
                      : "Premissas do serviço"}
                  </h2>
                  <p>
                    {kind === "product"
                      ? "Informe custos por unidade e percentuais sobre a receita."
                      : "Inclua a mão de obra, custos diretos e a margem do serviço."}
                  </p>
                </div>
                <Field
                  id="name"
                  label={`Nome ${kind === "product" ? "do produto" : "do serviço"}`}
                  error={error && !activeName.trim() ? error : undefined}
                >
                  <input
                    id="name"
                    className="asex-input"
                    value={activeName}
                    onChange={(event) =>
                      kind === "product"
                        ? updateProduct("name", event.target.value)
                        : updateService("name", event.target.value)
                    }
                    placeholder={
                      kind === "product"
                        ? "Ex.: Café em grãos 500g"
                        : "Ex.: Instalação elétrica"
                    }
                    aria-invalid={Boolean(error && !activeName.trim())}
                  />
                </Field>
                {kind === "service" ? (
                  <>
                    <div className="form-pair">
                      <Field id="category" label="Categoria (opcional)">
                        <input
                          id="category"
                          className="asex-input"
                          value={service.category}
                          onChange={(event) =>
                            updateService("category", event.target.value)
                          }
                          placeholder="Ex.: Manutenção"
                        />
                      </Field>
                      <Field id="description" label="Descrição (opcional)">
                        <input
                          id="description"
                          className="asex-input"
                          value={service.description}
                          onChange={(event) =>
                            updateService("description", event.target.value)
                          }
                          placeholder="Escopo resumido"
                        />
                      </Field>
                    </div>
                    <div className="input-rule" />
                    <h3 className="form-section-title">Mão de obra e custos</h3>
                    <div className="form-pair">
                      {serviceCostFields.map((field) => (
                        <MeasureField
                          key={field.key}
                          id={field.key}
                          label={field.label}
                          unit={field.unit}
                          value={service[field.key]}
                          onChange={(value) => updateService(field.key, value)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="input-rule" />
                    <div className="form-pair">
                      {productFields.slice(0, 5).map((field) => (
                        <MeasureField
                          key={field.key}
                          id={field.key}
                          label={field.label}
                          unit={field.unit}
                          value={product[field.key]}
                          onChange={(value) => updateProduct(field.key, value)}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div className="input-rule" />
                <h3 className="form-section-title">Taxas e objetivo</h3>
                <div className="form-pair">
                  {rateFields.map((field) => (
                    <MeasureField
                      key={field.key}
                      id={field.key}
                      label={field.label}
                      unit="%"
                      value={
                        kind === "product"
                          ? product[field.key]
                          : service[field.key]
                      }
                      onChange={(value) =>
                        kind === "product"
                          ? updateProduct(field.key, value)
                          : updateService(field.key, value)
                      }
                      hint={
                        field.key === "desiredMarginRate"
                          ? "Margem calculada sobre a receita."
                          : undefined
                      }
                    />
                  ))}
                </div>
                {error && activeName.trim() ? (
                  <p className="calculator-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="calculate-button">
                  Calcular preço <ArrowRight size={17} />
                </Button>
                <StatusMessage>{status}</StatusMessage>
              </form>
              <ResultPanel result={result} name={activeName} />
            </div>
            {result ? (
              <>
                <section className="save-panel" aria-label="Salvar e exportar">
                  <div>
                    <span className="eyebrow">
                      {storageMode === "cloud"
                        ? "Registro da organização"
                        : "Registro local"}
                    </span>
                    <h2>
                      {editingId
                        ? "Atualize esta simulação"
                        : "Salve para consultar depois"}
                    </h2>
                    <p>
                      {storageMode === "cloud"
                        ? "O cálculo é salvo na organização atual e pode ser exportado em backup JSON."
                        : "O cálculo é guardado apenas neste navegador e pode ser exportado em backup JSON."}
                    </p>
                  </div>
                  <div className="save-actions">
                    <Field id="reference-name" label="Nome da simulação">
                      <input
                        id="reference-name"
                        className="asex-input"
                        value={referenceName}
                        onChange={(event) => {
                          setReferenceName(event.target.value);
                          setDirty(true);
                        }}
                        placeholder={activeName || "Ex.: Preço padrão"}
                      />
                    </Field>
                    <Button onClick={saveSimulation}>
                      <Save size={16} />
                      {editingId ? "Salvar alterações" : "Salvar simulação"}
                    </Button>
                    <Button
                      className="outline-button"
                      onClick={exportPdf}
                      disabled={busyPdf}
                    >
                      <FileText size={16} />
                      {busyPdf ? "Gerando…" : "Exportar PDF"}
                    </Button>
                  </div>
                </section>
                <ScenarioSimulator
                  result={result}
                  desiredMarginRate={activeMargin}
                  values={scenarios}
                  onChange={(next) => {
                    setScenarios(next);
                    setDirty(true);
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}
        {view === "history" ? (
          <section className="history-view">
            <header className="view-header">
              <div>
                <p className="product-label">
                  {storageMode === "cloud"
                    ? "Arquivo da organização"
                    : "Arquivo local"}
                </p>
                <h1>Minhas simulações</h1>
                <p>
                  Abra, duplique ou revise os cálculos salvos{" "}
                  {storageMode === "cloud"
                    ? "na organização atual."
                    : "neste navegador."}
                </p>
              </div>
              <Button onClick={newSimulation}>
                <Plus size={16} />
                Nova simulação
              </Button>
            </header>
            <div className="history-toolbar">
              <label className="search-input">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome"
                  aria-label="Buscar simulações por nome"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <label className="filter-select">
                Tipo
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as "all" | SimulationKind)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="product">Produtos</option>
                  <option value="service">Serviços</option>
                </select>
              </label>
              <Button className="outline-button" onClick={exportBackup}>
                <Download size={16} />
                Backup JSON
              </Button>
              <input
                ref={importRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={importBackup}
              />
              <Button
                className="outline-button"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={16} />
                Importar
              </Button>
            </div>
            {historyError ? (
              <p className="calculator-error" role="alert">
                {historyError}
              </p>
            ) : null}
            {storageMode === "cloud" && localImportCount ? (
              <div className="delete-confirm local-import" role="status">
                <span>
                  Há {localImportCount} simulação(ões) neste navegador. Você
                  pode copiá-las para a organização sem apagar os dados locais.
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setConfirmLocalImport(true)}
                  >
                    Revisar importação
                  </button>
                </div>
              </div>
            ) : null}
            {confirmLocalImport ? (
              <div className="delete-confirm local-import" role="alert">
                <span>
                  Importar {localImportCount ?? 0} simulação(ões) para a
                  organização atual? Registros já existentes não serão
                  duplicados e o histórico local continuará intacto.
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setConfirmLocalImport(false)}
                  >
                    Cancelar
                  </button>
                  <button type="button" onClick={importLocalHistory}>
                    Importar agora
                  </button>
                </div>
              </div>
            ) : null}
            {pendingDelete ? (
              <div className="delete-confirm" role="alert">
                <span>
                  Excluir “{pendingDelete.name}” deste navegador? Essa ação não
                  pode ser desfeita.
                </span>
                <div>
                  <button type="button" onClick={() => setPendingDelete(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={removeSimulation}
                  >
                    Excluir simulação
                  </button>
                </div>
              </div>
            ) : null}
            {simulations.length === 0 ? (
              <EmptyState onNew={newSimulation} />
            ) : (
              <>
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Simulação</th>
                        <th>Tipo</th>
                        <th>Preço sugerido</th>
                        <th>Margem</th>
                        <th aria-sort="descending">Atualizada</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const itemResult = calculate(item.kind, item.input);
                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.name}</strong>
                              <span>{item.input.name}</span>
                            </td>
                            <td>
                              {item.kind === "product" ? "Produto" : "Serviço"}
                            </td>
                            <td>{BRL.format(itemResult.recommendedPrice)}</td>
                            <td>
                              {percent.format(itemResult.estimatedMarginRate)}
                            </td>
                            <td>{dateTime.format(new Date(item.updatedAt))}</td>
                            <td className="row-actions">
                              <button
                                type="button"
                                onClick={() => openSimulation(item)}
                              >
                                Abrir
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateSimulation(item)}
                                aria-label={`Duplicar ${item.name}`}
                              >
                                <Copy size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(item)}
                                aria-label={`Excluir ${item.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="history-cards">
                  {filtered.map((item) => {
                    const itemResult = calculate(item.kind, item.input);
                    return (
                      <article key={item.id}>
                        <div>
                          <span>
                            {item.kind === "product" ? "Produto" : "Serviço"}
                          </span>
                          <h2>{item.name}</h2>
                          <p>{item.input.name}</p>
                        </div>
                        <dl>
                          <div>
                            <dt>Preço sugerido</dt>
                            <dd>{BRL.format(itemResult.recommendedPrice)}</dd>
                          </div>
                          <div>
                            <dt>Margem</dt>
                            <dd>
                              {percent.format(itemResult.estimatedMarginRate)}
                            </dd>
                          </div>
                          <div>
                            <dt>Atualizada</dt>
                            <dd>{dateTime.format(new Date(item.updatedAt))}</dd>
                          </div>
                        </dl>
                        <div className="card-actions">
                          <button
                            type="button"
                            onClick={() => openSimulation(item)}
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateSimulation(item)}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(item)}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {filtered.length === 0 ? (
                  <div className="history-empty compact">
                    <Search size={24} />
                    <h2>Nenhum resultado</h2>
                    <p>
                      Ajuste a busca ou o filtro para encontrar uma simulação.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}
        {view === "reports" ? (
          <section className="report-view">
            <header className="view-header">
              <div>
                <p className="product-label">Personalização local</p>
                <h1>Dados para relatórios</h1>
                <p>
                  Essas informações aparecem nos PDFs e ficam somente neste
                  navegador.
                </p>
              </div>
            </header>
            {historyError ? (
              <p className="calculator-error" role="alert">
                {historyError}
              </p>
            ) : null}
            <div className="report-form">
              <div className="report-logo">
                <span>Logotipo opcional</span>
                {company.logoDataUrl ? (
                  <img src={company.logoDataUrl} alt="Prévia do logotipo" />
                ) : (
                  <div className="logo-placeholder">Sua marca</div>
                )}
                <input
                  id="company-logo"
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={chooseLogo}
                />
                <label htmlFor="company-logo" className="upload-button">
                  <Upload size={16} />
                  Selecionar imagem
                </label>
                {company.logoDataUrl ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      setCompany((old) => ({ ...old, logoDataUrl: undefined }))
                    }
                  >
                    Remover logotipo
                  </button>
                ) : null}
                <small>PNG, JPG ou WebP, até 1 MB. SVG não é aceito.</small>
              </div>
              <div className="report-fields">
                <Field id="legal-name" label="Nome da empresa">
                  <input
                    id="legal-name"
                    className="asex-input"
                    value={company.legalName}
                    onChange={(event) =>
                      setCompany((old) => ({
                        ...old,
                        legalName: event.target.value,
                      }))
                    }
                    placeholder="Ex.: ASEX Comércio Ltda."
                  />
                </Field>
                <Field id="trade-name" label="Nome comercial (opcional)">
                  <input
                    id="trade-name"
                    className="asex-input"
                    value={company.tradeName ?? ""}
                    onChange={(event) =>
                      setCompany((old) => ({
                        ...old,
                        tradeName: event.target.value,
                      }))
                    }
                    placeholder="Ex.: ASEX Business"
                  />
                </Field>
                <Field id="company-phone" label="Telefone (opcional)">
                  <input
                    id="company-phone"
                    className="asex-input"
                    type="tel"
                    value={company.phone ?? ""}
                    onChange={(event) =>
                      setCompany((old) => ({
                        ...old,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="(00) 00000-0000"
                  />
                </Field>
                <Field id="company-email" label="E-mail (opcional)">
                  <input
                    id="company-email"
                    className="asex-input"
                    type="email"
                    value={company.email ?? ""}
                    onChange={(event) =>
                      setCompany((old) => ({
                        ...old,
                        email: event.target.value,
                      }))
                    }
                    placeholder="contato@empresa.com"
                  />
                </Field>
                <Field
                  id="accent-color"
                  label="Cor de destaque (opcional)"
                  hint="Usada como referência visual no relatório."
                >
                  <input
                    id="accent-color"
                    className="asex-input color-input"
                    type="color"
                    value={company.accentColor || "#9d1d2c"}
                    onChange={(event) =>
                      setCompany((old) => ({
                        ...old,
                        accentColor: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button onClick={saveCompany}>
                  <Save size={16} />
                  Salvar dados para relatórios
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </section>
      {pendingView ? (
        <div className="unsaved-bar" role="alert">
          <span>Há alterações não salvas. Deseja sair da calculadora?</span>
          <div>
            <button type="button" onClick={() => setPendingView(null)}>
              Continuar editando
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                setDirty(false);
                setView(pendingView);
                setPendingView(null);
              }}
            >
              Descartar alterações
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
