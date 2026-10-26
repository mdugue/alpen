import { expect, test } from "bun:test";

import { rankOf, shortName } from "@/lib/prominence";
import type { RoadType } from "@/lib/types";

const road = (fame: number, type: RoadType = "pass", beauty = 4) => ({
  beauty,
  fame,
  type,
});

test("a dead end counts a step lower, a pearl a step higher, a classic stays", () => {
  expect(rankOf(road(3))).toBe(3);
  expect(rankOf(road(3, "spur"))).toBe(2);
  expect(rankOf(road(2, "valley"))).toBe(1);
  expect(rankOf(road(1, "balcony"))).toBe(0);
  expect(rankOf(road(3, "pass", 5))).toBe(4);
  expect(rankOf(road(2, "spur", 5))).toBe(2);
  expect(rankOf(road(4, "spur"))).toBe(4);
  expect(rankOf(road(5, "spur", 5))).toBe(5);
});

test("the overview drops the generic word in front of a name", () => {
  expect(shortName("Col du Galibier")).toBe("Galibier");
  expect(shortName("Passo dello Stelvio")).toBe("Stelvio");
  expect(shortName("Passo del Mortirolo")).toBe("Mortirolo");
  expect(shortName("Colle dell'Agnello")).toBe("Agnello");
  expect(shortName("Col de l'Iseran")).toBe("Iseran");
  expect(shortName("Col d'Izoard")).toBe("Izoard");
  expect(shortName("Col de la Croix de Fer")).toBe("Croix de Fer");
  expect(shortName("Puerto de la Ragua")).toBe("Ragua");
  expect(shortName("Passo San Marco")).toBe("San Marco");
  expect(shortName("Coll de sa Batalla")).toBe("Sa Batalla");
});

test("a name without a generic word, or one that would shrink to nothing, stays whole", () => {
  expect(shortName("Alpe d'Huez")).toBe("Alpe d'Huez");
  expect(shortName("Mont Ventoux")).toBe("Mont Ventoux");
  expect(shortName("Nigerpass")).toBe("Nigerpass");
  expect(shortName("Timmelsjoch")).toBe("Timmelsjoch");
  expect(shortName("Col d'Ey")).toBe("Col d'Ey");
});
