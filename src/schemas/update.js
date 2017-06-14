import { source } from "../chimpanzee-utils";
import { collection } from "./";
import { parse, capture, exists, any, array, repeatingItem, Match } from "chimpanzee";
import composite from "../chimpanzee-utils/composite";
import R from "ramda";
import { update } from "../db-statements";

export default function(state, analysisState) {
  function getArrowFunctionBody(identifier) {
    /*
      There are two types of update expressions.
        1. STANDARD
          db.users = db.users.filter(x => x.id === 10 ? { ...x, active: true } : x)
        2. INVERSE
          db.users = db.users.filter(x => x.id !== 10`` ? x : { ...x, active: true })
    */
    const conditionalExpression = {
      type: "ConditionalExpression",
      test: capture({ selector: "path" })
    };

    const updatedObject = {
      type: "ObjectExpression",
      properties: array([
        {
          type: "SpreadProperty",
          argument: identifier
        },
        repeatingItem(capture())
      ])
    };

    function identifierPropsOf(x) {
      const intersectObj = (a, b) => R.pick(R.keys(a), b);
      return intersectObj(identifier, x);
    }

    const standardConditionExpression = {
      ...conditionalExpression,
      consequent: updatedObject,
      alternate: exists(x => R.equals(identifierPropsOf(x), identifier))
    };

    const inverseConditionExpression = {
      ...conditionalExpression,
      consequent: exists(x => R.equals(identifierPropsOf(x), identifier)),
      alternate: updatedObject
    };

    return any([standardConditionExpression, inverseConditionExpression]);
  }

  return composite(
    {
      type: "AssignmentExpression",
      operator: "=",
      left: source([collection])(state, analysisState),
      right: {
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: source([collection])(state, analysisState),
          property: {
            type: "Identifier",
            name: "map"
          }
        },
        arguments: [
          {
            type: "ArrowFunctionExpression",
            params: [capture()],
            body: capture()
          }
        ]
      }
    },
    {
      build: obj => context => result =>
        R.equals(result.value.left, result.value.object)
          ? (() => {
              const { params, body } = result.value.arguments[0];
              const identifier = { type: "Identifier", name: params[0].name };
              const arrowFunctionBody = getArrowFunctionBody(identifier);
              const update = parse(arrowFunctionBody)(body)(context);
              console.log(update);
              return update instanceof Match
                ? () => {
                    console.log(update);
                    return new Skip(`yoyo!`);
                  }
                : update;
            })()
          : new Skip(`The result of the map() must be assigned to the same collection.`)
    }
  );
}
