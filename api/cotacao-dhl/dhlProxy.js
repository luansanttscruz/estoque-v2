// api/cotacao-dhl/dhlProxy.js

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const normalizeCep = (value) => String(value || "").replace(/\D/g, "");
const DHL_UNAVAILABLE_MESSAGE =
  "Indisponível para essa região. Consulte através do site da DHL.";

const normalizeNumber = (value, fallback) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

function gerarXmlCotacao({
  cidade,
  cep,
  valorDeclarado,
  peso,
  origem,
  dataEnvio,
  altura,
  largura,
  comprimento,
}) {
  const dataHoje = dataEnvio || new Date().toISOString().split("T")[0];
  const origemCidade = origem?.cidade || "Rio de Janeiro";
  const origemCep = normalizeCep(origem?.cep || "22250040");
  const destinoCep = normalizeCep(cep);
  const declaredValue = normalizeNumber(valorDeclarado, 1).toFixed(2);
  const packageWeight = normalizeNumber(peso, 2);
  const packageHeight = normalizeNumber(altura, 10);
  const packageWidth = normalizeNumber(largura, 33);
  const packageDepth = normalizeNumber(comprimento, 34);

  return `
    <req:QuoteRequest xmlns:req="http://www.dhl.com">
      <Request>
        <ServiceHeader>
          <SiteID>${escapeXml(process.env.DHL_SITE_ID)}</SiteID>
          <Password>${escapeXml(process.env.DHL_PASSWORD)}</Password>
        </ServiceHeader>
      </Request>
      <From>
        <CountryCode>BR</CountryCode>
        <Postalcode>${escapeXml(origemCep)}</Postalcode>
        <City>${escapeXml(origemCidade)}</City>
      </From>
      <To>
        <CountryCode>BR</CountryCode>
        <Postalcode>${escapeXml(destinoCep)}</Postalcode>
        <City>${escapeXml(cidade)}</City>
      </To>
      <BkgDetails>
        <PaymentCountryCode>BR</PaymentCountryCode>
        <Date>${escapeXml(dataHoje)}</Date>
        <ReadyTime>PT10H21M</ReadyTime>
        <DimensionUnit>CM</DimensionUnit>
        <WeightUnit>KG</WeightUnit>
        <Pieces>
          <Piece>
            <PieceID>1</PieceID>
            <Height>${packageHeight}</Height>
            <Depth>${packageDepth}</Depth>
            <Width>${packageWidth}</Width>
            <Weight>${packageWeight}</Weight>
          </Piece>
        </Pieces>
        <IsDutiable>N</IsDutiable>
        <NetworkTypeCode>AL</NetworkTypeCode>
      </BkgDetails>
      <Dutiable>
        <DeclaredValue>${declaredValue}</DeclaredValue>
        <DeclaredCurrency>BRL</DeclaredCurrency>
      </Dutiable>
    </req:QuoteRequest>
  `.trim();
}

const findFirstXmlValue = (xml, tags) => {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    const value = match?.[1]?.replace(/<[^>]+>/g, "").trim();
    if (value) return value;
  }
  return null;
};

function parseDhlQuoteResponse(xml) {
  const text = String(xml || "");
  const errorMessage = findFirstXmlValue(text, [
    "ConditionData",
    "Condition",
    "StatusMessage",
    "Message",
    "ErrorMessage",
  ]);

  const preco = findFirstXmlValue(text, [
    "ShippingCharge",
    "TotalAmount",
    "ChargeAmount",
    "ChargeValue",
    "QtdSInAdCur",
    "QtdShp",
  ]);

  const entrega = findFirstXmlValue(text, [
    "EstimatedDeliveryDate",
    "DeliveryDate",
    "DlvyDate",
    "DeliveryTime",
    "QtdDlv",
  ]);

  if (preco && entrega) {
    return { available: true, preco, entrega };
  }

  return {
    available: false,
    mensagem: errorMessage || DHL_UNAVAILABLE_MESSAGE,
  };
}

module.exports = { gerarXmlCotacao, normalizeCep, parseDhlQuoteResponse };
