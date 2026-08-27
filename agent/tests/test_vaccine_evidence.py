import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).parents[1] / "tomo" / "tools" / "vaccine_evidence.py"
SPEC = importlib.util.spec_from_file_location("vaccine_evidence", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
normalize_vaccine_evidence = MODULE.normalize_vaccine_evidence


class VaccineEvidenceNormalizationTests(unittest.TestCase):
    def test_normalizes_certificate_without_conflating_three_dates(self):
        result = normalize_vaccine_evidence(
            [
                {
                    "care_kind": "VACCINE",
                    "care_item": "Rabies",
                    "source_record_type": "vaccination_certificate",
                    "assertions": [
                        {
                            "assertion_type": "administration",
                            "date": "2026-04-12",
                            "source_context": " Vaccination   date 04/12/2026 ",
                        },
                        {
                            "assertion_type": "next_due",
                            "date": "2029-04-11",
                        },
                    ],
                    "product_details": {
                        "product_expiration_date": "2027-01-31"
                    },
                }
            ]
        )

        self.assertEqual(result[0]["assertions"][0]["date"], "2026-04-12")
        self.assertEqual(result[0]["assertions"][1]["date"], "2029-04-11")
        self.assertEqual(
            result[0]["product_details"]["product_expiration_date"],
            "2027-01-31",
        )

    def test_receipt_can_report_due_but_cannot_establish_administration(self):
        result = normalize_vaccine_evidence(
            [
                {
                    "care_kind": "vaccine",
                    "care_item": "rabies",
                    "source_record_type": "receipt",
                    "assertions": [
                        {"assertion_type": "administration", "date": "2026-04-12"},
                        {"assertion_type": "next_due", "date": "2029-04-11"},
                    ],
                }
            ]
        )

        self.assertEqual(
            [item["assertion_type"] for item in result[0]["assertions"]],
            ["next_due"],
        )

    def test_other_vaccines_remain_outside_the_rabies_pilot(self):
        result = normalize_vaccine_evidence(
            [
                {
                    "care_kind": "vaccine",
                    "care_item": "bordetella",
                    "source_record_type": "receipt",
                    "assertions": [
                        {"assertion_type": "next_due", "date": "2027-08-10"}
                    ],
                }
            ]
        )
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
