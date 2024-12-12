import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { InfoCircledIcon } from '@radix-ui/react-icons';


interface HealthFactorCardProps {
  value: number;
}

export function HealthFactorCard({ value }: HealthFactorCardProps) {
  return (
    <Box
      className="health-factor-card"
      style={{
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: '#1a1a1a',
        flex: 1,
        minHeight: '160px',
        border: 'none',
      }}
    >
      <Flex direction="column" gap="3">
        <Text size="5" weight="bold" style={{ color: "white" }}>
          Health Factor
        </Text>
        
        <Flex align="center" justify="between" style={{ marginTop: '8px' }}>
          <Text size="8" style={{ color: 'white' }}>
            {value}
          </Text>
          <svg width="102" height="60" viewBox="0 0 102 60" fill="none" xmlns="http://www.w3.org/2000/svg" color="var(--ps-primary)">
            <path 
              d="M0 30.2579H23.3094L25.3586 25.0996L27.9201 37.9955L33.2992 1.62897L36.6291 58.371L42.0082 16.5882L44.0574 30.2579H47.3873L49.6926 26.3891L51.2295 45.991L53.791 30.2579H66.0861L69.416 19.6833L72.4898 43.1539L77.8689 30.5158C85.9714 30.5158 93.8974 30.5158 102 30.5158" 
              stroke="url(#paint0_linear_1660_3525)" 
              strokeWidth="2" 
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient 
                id="paint0_linear_1660_3525" 
                x1="102" 
                y1="30" 
                x2="4.67353" 
                y2="51.3274" 
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="currentColor" stopOpacity="0" />
                <stop offset="0.488198" stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </Flex>

        <Flex gap="2">
              <Button variant="soft" className="risk-details-button">
                RISK DETAILS
              </Button>
          <Button variant="soft" className="notifi-button">
            <InfoCircledIcon /> NOTIFI
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
} 