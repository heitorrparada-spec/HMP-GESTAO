import type { PrismaClient } from "@/generated/prisma/client";

const DEMO = "[DEMO] ";

function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function reset(prisma: PrismaClient) {
  await prisma.activityLog.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.validationRecord.deleteMany();
  await prisma.acceptanceCriteria.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.decisionParticipant.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.task.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.release.deleteMany();
  await prisma.product.deleteMany();
  await prisma.person.deleteMany();
  await prisma.company.deleteMany();
}

/**
 * Popula o banco com os dados de demonstração da HMP.
 * Reseta tudo antes — chamável tanto pelo script de CLI (prisma/seed.ts)
 * quanto pela rota /api/admin/seed (para bootstrap sem acesso local ao banco).
 */
export async function seedDatabase(prisma: PrismaClient) {
  await reset(prisma);

  const company = await prisma.company.create({ data: { name: "HMP" } });

  const heitor = await prisma.person.create({
    data: { name: "Heitor", email: "heitor@hmp.dev", role: "PRODUCT" },
  });
  const linard = await prisma.person.create({
    data: { name: "Linard", email: "linard@hmp.dev", role: "ARCHITECTURE" },
  });
  const pedro = await prisma.person.create({
    data: { name: "Pedro", email: "pedro@hmp.dev", role: "ENGINEERING" },
  });

  const nutria = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Nutria",
      description: "Plataforma de gestão para nutricionistas.",
      status: "DEVELOPMENT",
    },
  });

  const exomia = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Exomia",
      description: "Segunda vertente de produto da HMP — ainda em descoberta.",
      status: "DISCOVERY",
    },
  });

  const release = await prisma.release.create({
    data: {
      productId: nutria.id,
      name: "Nutria — Ciclo Q3 2026",
      targetDate: new Date("2026-09-30"),
      status: "IN_PROGRESS",
    },
  });

  const feature = await prisma.feature.create({
    data: {
      productId: nutria.id,
      releaseId: release.id,
      title: "Elaboração do Plano Alimentar",
      context:
        "Nutricionistas hoje montam planos alimentares manualmente em planilhas ou papel, calculando macronutrientes à mão. A pesquisa de mercado mostrou que concorrentes como a Dietbox já oferecem cálculo automático como diferencial.",
      problem:
        "O processo manual de criação de um plano alimentar é lento e sujeito a erro de cálculo, limitando quantos pacientes um nutricionista consegue atender por dia.",
      userNeed:
        '"Como nutricionista, preciso montar planos alimentares completos e nutricionalmente corretos em minutos, não em horas."',
      objective:
        "Reduzir o tempo de criação de um plano alimentar em pelo menos 70%, com cálculo automático de macronutrientes confiável.",
      functionalFlow:
        "1) Nutricionista seleciona o paciente. 2) Define refeições e horários. 3) Adiciona alimentos por refeição. 4) Sistema calcula macros automaticamente por refeição e total do dia. 5) Nutricionista pode ajustar manualmente qualquer refeição. 6) Plano é salvo e pode ser exportado/compartilhado com o paciente.",
      architectureNotes:
        "Módulo novo `plano-alimentar` com entidades PlanoAlimentar → Refeicao → ItemAlimento, cada ItemAlimento referenciando uma tabela nutricional (fonte: base TACO + entrada manual). Cálculo de macros roda no backend a cada alteração de refeição, não no cliente, para manter consistência caso o plano seja acessado por múltiplos dispositivos.",
      priority: "P0",
      status: "DEVELOPMENT",
      ownerId: heitor.id,
      architectId: linard.id,
      techLeadId: pedro.id,
    },
  });

  await prisma.requirement.createMany({
    data: [
      {
        featureId: feature.id,
        description: "Sistema deve calcular macronutrientes automaticamente a partir dos alimentos selecionados",
        priority: "P0",
        status: "IMPLEMENTED",
        source: "Pesquisa de mercado (Dietbox) + reunião de 16/09",
      },
      {
        featureId: feature.id,
        description: "Nutricionista pode editar manualmente qualquer refeição do plano gerado",
        priority: "P1",
        status: "APPROVED",
        source: "Especificação funcional",
      },
      {
        featureId: feature.id,
        description: "Sistema deve sugerir substituições de alimentos nutricionalmente equivalentes",
        priority: "P2",
        status: "PROPOSED",
        source: "Ideia levantada em discovery, ainda não aprofundada",
      },
    ],
  });

  const artifactC4 = await prisma.artifact.create({
    data: {
      featureId: feature.id,
      authorId: linard.id,
      type: "C4",
      title: DEMO + "C4 — Contexto do módulo de Plano Alimentar",
      description: "Diagrama de contexto mostrando como o módulo se relaciona com o restante do Nutria.",
      url: "https://example.com/hmp-os-demo/c4-plano-alimentar",
      version: "v1",
    },
  });

  const artifactClass = await prisma.artifact.create({
    data: {
      featureId: feature.id,
      authorId: linard.id,
      type: "CLASS_DIAGRAM",
      title: DEMO + "Diagrama de classes — PlanoAlimentar / Refeicao / ItemAlimento",
      description: "Modelagem das entidades centrais do módulo.",
      url: "https://example.com/hmp-os-demo/class-diagram-plano-alimentar",
      version: "v1",
    },
  });

  const artifactResearch = await prisma.artifact.create({
    data: {
      featureId: feature.id,
      authorId: heitor.id,
      type: "RESEARCH",
      title: DEMO + "Pesquisa de mercado — Dietbox",
      description: "Comparativo de recursos de cálculo nutricional oferecidos pela Dietbox.",
      url: "https://example.com/hmp-os-demo/pesquisa-dietbox",
      version: "v1",
    },
  });

  const artifactSpec = await prisma.artifact.create({
    data: {
      featureId: feature.id,
      authorId: heitor.id,
      type: "SPECIFICATION",
      title: DEMO + "Especificação funcional — Plano Alimentar",
      description: "Documento detalhando requisitos e fluxo funcional aprovados.",
      url: "https://example.com/hmp-os-demo/spec-plano-alimentar",
      version: "v1",
    },
  });

  const meeting = await prisma.meeting.create({
    data: {
      title: "Reunião HMP — Planejamento Nutria",
      date: new Date("2026-09-16T14:00:00"),
      agenda:
        "- Validação dos diagramas de arquitetura do Plano Alimentar\n- Priorização do Plano Alimentar frente ao restante do backlog do Nutria\n- Próximos recursos do Nutria",
      notes:
        "Heitor apresentou a pesquisa da Dietbox e reforçou a demanda de mercado por cálculo automático de macros. Linard confirmou viabilidade técnica da arquitetura proposta (C4 + diagrama de classes revisados em reunião). Decidido priorizar o Plano Alimentar como P0 do ciclo atual.",
    },
  });

  await prisma.meetingParticipant.createMany({
    data: [heitor, linard, pedro].map((p) => ({ meetingId: meeting.id, personId: p.id })),
  });

  await prisma.artifact.updateMany({
    where: { id: { in: [artifactC4.id, artifactClass.id] } },
    data: { meetingId: meeting.id },
  });

  const decisionPriority = await prisma.decision.create({
    data: {
      title: "Planejamento Alimentar será tratado como Feature P0 do Nutria",
      context:
        "O backlog do Nutria tem múltiplas Features candidatas para o ciclo atual, mas a pesquisa de mercado e o feedback de clientes apontam o Plano Alimentar como maior alavanca de valor.",
      decision: "Plano Alimentar entra como prioridade P0 do ciclo Q3 2026, à frente das demais Features do backlog.",
      reason: "Diferencial competitivo direto frente à Dietbox e alta demanda de clientes atuais.",
      alternatives: "Manter prioridade P1 e avançar outras Features em paralelo — rejeitado por falta de capacidade de time para paralelizar.",
      authorId: heitor.id,
      decidedAt: meeting.date,
      meetingId: meeting.id,
      featureId: feature.id,
      productId: nutria.id,
      participants: {
        create: [heitor, linard, pedro].map((p) => ({ personId: p.id })),
      },
    },
  });

  const decisionMacros = await prisma.decision.create({
    data: {
      title: "Plano Alimentar incluirá cálculo automático de macronutrientes",
      context: "Nutricionistas hoje calculam macros manualmente; é o principal ponto de atrito identificado na pesquisa.",
      decision: "O cálculo de macronutrientes por refeição e por dia será automático, rodando no backend.",
      reason: "Reduzir tempo de criação do plano e eliminar erros de cálculo manual.",
      alternatives: "Integrar API externa de nutrição — adiado por custo; manter cálculo manual — rejeitado, não diferencia o produto.",
      authorId: heitor.id,
      decidedAt: meeting.date,
      meetingId: meeting.id,
      featureId: feature.id,
      productId: nutria.id,
      participants: {
        create: [heitor, linard, pedro].map((p) => ({ personId: p.id })),
      },
    },
  });

  await prisma.decision.create({
    data: {
      title: "Exomia entra em fase de Discovery formal a partir de outubro/2026",
      context: "A Exomia existe hoje apenas como ideia inicial da HMP, sem processo de descoberta estruturado.",
      decision: "Iniciar Discovery formal da Exomia em outubro/2026, após o ciclo atual do Nutria.",
      reason: "Evitar dividir o time entre dois produtos antes do Plano Alimentar (P0) ser entregue.",
      authorId: heitor.id,
      decidedAt: new Date("2026-09-05T11:00:00"),
      productId: exomia.id,
      participants: { create: [{ personId: heitor.id }] },
    },
  });

  const taskData: Array<{
    title: string;
    status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "REVIEW" | "DONE";
    assigneeId: string;
    decisionId?: string;
    blockedReason?: string;
    dueDate?: Date;
  }> = [
    { title: "Consolidar pesquisa Dietbox", status: "DONE", assigneeId: heitor.id },
    { title: "Analisar formulário de mercado", status: "DONE", assigneeId: heitor.id },
    { title: "Definir requisitos funcionais", status: "DONE", assigneeId: heitor.id },
    { title: "Criar C4", status: "DONE", assigneeId: linard.id },
    { title: "Criar diagrama de classe", status: "DONE", assigneeId: linard.id },
    {
      title: "Implementar backend",
      status: "IN_PROGRESS",
      assigneeId: pedro.id,
      decisionId: decisionMacros.id,
      dueDate: daysFromNow(2),
    },
    {
      title: "Implementar frontend",
      status: "BLOCKED",
      assigneeId: pedro.id,
      blockedReason: "Aguardando endpoints do backend ficarem prontos",
      dueDate: daysFromNow(4),
    },
    { title: "Criar testes", status: "TODO", assigneeId: pedro.id, dueDate: daysFromNow(6) },
    { title: "Validar recurso", status: "TODO", assigneeId: heitor.id, dueDate: daysFromNow(7) },
  ];

  const tasks = [];
  for (const t of taskData) {
    const task = await prisma.task.create({
      data: {
        featureId: feature.id,
        title: t.title,
        status: t.status,
        priority: "P0",
        assigneeId: t.assigneeId,
        createdById: linard.id,
        decisionId: t.decisionId,
        blockedReason: t.blockedReason,
        dueDate: t.dueDate,
      },
    });
    tasks.push(task);
  }
  const [, , , , , taskBackend, taskFrontend, taskTests] = tasks;

  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskFrontend.id, dependsOnId: taskBackend.id },
      { taskId: taskTests.id, dependsOnId: taskBackend.id },
    ],
  });

  await prisma.acceptanceCriteria.createMany({
    data: [
      {
        featureId: feature.id,
        description: "Cálculo de macros bate com valores de referência para 10 casos de teste",
      },
      { featureId: feature.id, description: "Nutricionista consegue editar o plano manualmente" },
      { featureId: feature.id, description: "Tempo de geração do plano é menor que 3 segundos" },
    ],
  });

  // ---------- ActivityLog: reconstrói a cadeia completa da Feature ----------
  type LogInput = {
    at: Date;
    entityType: string;
    entityId: string;
    eventType: string;
    description: string;
    actor?: { id: string; name: string };
  };

  const logs: LogInput[] = [
    {
      at: new Date("2026-09-01T09:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.created",
      description: `Feature "${feature.title}" criada`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-02T10:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.status_changed",
      description: `Feature "${feature.title}" avançou de Backlog para Discovery`,
      actor: heitor,
    },
    // Vincular artifact não é ação da UI (Artifacts são só leitura): estes eventos narram a demo e apontam para o artifact.
    {
      at: new Date("2026-09-02T15:00:00"),
      entityType: "artifact",
      entityId: artifactResearch.id,
      eventType: "artifact.linked",
      description: `Artifact "${artifactResearch.title}" vinculado à Feature "${feature.title}"`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-05T09:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.status_changed",
      description: `Feature "${feature.title}" avançou de Discovery para Specification`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-05T09:30:00"),
      entityType: "requirement",
      entityId: feature.id,
      eventType: "requirement.added",
      description: `3 requisitos adicionados à Feature "${feature.title}"`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-06T11:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.field_changed",
      description: `Prioridade da Feature "${feature.title}" definida como P0`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T14:00:00"),
      entityType: "meeting",
      entityId: meeting.id,
      eventType: "meeting.created",
      description: `Reunião "${meeting.title}" registrada`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T14:20:00"),
      entityType: "decision",
      entityId: decisionPriority.id,
      eventType: "decision.created",
      description: `Decisão registrada: "${decisionPriority.title}" (afeta ${feature.title}) na reunião "${meeting.title}"`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T14:25:00"),
      entityType: "decision",
      entityId: decisionMacros.id,
      eventType: "decision.created",
      description: `Decisão registrada: "${decisionMacros.title}" (afeta ${feature.title}) na reunião "${meeting.title}"`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T15:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.status_changed",
      description: `Feature "${feature.title}" avançou de Specification para Architecture`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T16:00:00"),
      entityType: "artifact",
      entityId: artifactC4.id,
      eventType: "artifact.linked",
      description: `Artifact "${artifactC4.title}" vinculado à Feature "${feature.title}"`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T16:30:00"),
      entityType: "artifact",
      entityId: artifactClass.id,
      eventType: "artifact.linked",
      description: `Artifact "${artifactClass.title}" vinculado à Feature "${feature.title}"`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T17:00:00"),
      entityType: "artifact",
      entityId: artifactSpec.id,
      eventType: "artifact.linked",
      description: `Artifact "${artifactSpec.title}" vinculado à Feature "${feature.title}"`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T18:00:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "feature.status_changed",
      description: `Feature "${feature.title}" avançou de Architecture para Development`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T18:05:00"),
      entityType: "feature",
      entityId: feature.id,
      eventType: "task.created",
      description: `${tasks.length - 1} tasks criadas para a Feature "${feature.title}"`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T18:06:00"),
      entityType: "task",
      entityId: taskBackend.id,
      eventType: "task.created_from_decision",
      description: `Task "${taskBackend.title}" criada a partir da decisão "${decisionMacros.title}" (reunião "${meeting.title}")`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T19:00:00"),
      entityType: "task",
      entityId: tasks[0].id,
      eventType: "task.status_changed",
      description: `Task "${tasks[0].title}" concluída`,
      actor: heitor,
    },
    {
      at: new Date("2026-09-16T19:10:00"),
      entityType: "task",
      entityId: tasks[3].id,
      eventType: "task.status_changed",
      description: `Task "${tasks[3].title}" concluída`,
      actor: linard,
    },
    {
      at: new Date("2026-09-16T19:20:00"),
      entityType: "task",
      entityId: tasks[4].id,
      eventType: "task.status_changed",
      description: `Task "${tasks[4].title}" concluída`,
      actor: linard,
    },
    {
      at: new Date("2026-09-17T09:00:00"),
      entityType: "task",
      entityId: taskBackend.id,
      eventType: "task.status_changed",
      description: `Task "${taskBackend.title}" mudou de To do para In progress`,
      actor: pedro,
    },
    {
      at: new Date("2026-09-17T09:30:00"),
      entityType: "task",
      entityId: taskFrontend.id,
      eventType: "task.status_changed",
      description: `Task "${taskFrontend.title}" foi bloqueada: aguardando endpoints do backend`,
      actor: pedro,
    },
  ];

  for (const log of logs) {
    await prisma.activityLog.create({
      data: {
        entityType: log.entityType,
        entityId: log.entityId,
        eventType: log.eventType,
        description: log.description,
        actorId: log.actor?.id,
        actorName: log.actor?.name,
        createdAt: log.at,
      },
    });
  }

  const summary = {
    company: company.name,
    people: [heitor.name, linard.name, pedro.name],
    products: [nutria.name, exomia.name],
    feature: { title: feature.title, status: feature.status },
    tasks: tasks.length,
    decisions: 3,
    artifacts: 4,
    activityLog: logs.length,
  };

  console.log("Seed concluído:", summary);
  return summary;
}
